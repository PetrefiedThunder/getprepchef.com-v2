/**
 * Document Upload Service
 * Handles vendor document uploads to S3 with security and validation
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { logger } from '../../config/logger';
import { VendorDocument } from './vendor_document.model';

interface UploadOptions {
  vendor_id: string;
  document_type: string;
  file_name: string;
  file_buffer: Buffer;
  mime_type: string;
  metadata?: Record<string, string>;
}

interface PresignedUrlOptions {
  document_id: string;
  expires_in_seconds?: number;
}

export class DocumentUploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.bucketName = process.env.S3_BUCKET_NAME || 'prepchef-vendor-docs';
  }

  /**
   * Upload vendor document to S3
   * @param options Upload configuration
   * @returns Created VendorDocument record
   */
  async uploadDocument(options: UploadOptions): Promise<any> {
    const {
      vendor_id,
      document_type,
      file_name,
      file_buffer,
      mime_type,
      metadata = {},
    } = options;

    try {
      // Validate file size (max 10MB)
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (file_buffer.length > maxSizeBytes) {
        throw new Error('File size exceeds maximum allowed size of 10MB');
      }

      // Validate file type (whitelist)
      const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedMimeTypes.includes(mime_type)) {
        throw new Error(`File type ${mime_type} is not allowed`);
      }

      // Generate secure filename
      const fileExtension = file_name.split('.').pop();
      const secureFileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
      const s3Key = `vendors/${vendor_id}/${document_type}/${secureFileName}`;

      // Calculate file hash for integrity verification
      const fileHash = crypto.createHash('sha256').update(file_buffer).digest('hex');

      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: file_buffer,
        ContentType: mime_type,
        Metadata: {
          ...metadata,
          vendor_id,
          document_type,
          original_filename: file_name,
          sha256_hash: fileHash,
        },
        ServerSideEncryption: 'AES256', // Encrypt at rest
      });

      await this.s3Client.send(uploadCommand);

      logger.info(`Document uploaded to S3: ${s3Key}`);

      // Create database record
      const vendorDocument = await VendorDocument.create({
        vendor_id,
        document_type,
        file_name: file_name,
        file_url: `s3://${this.bucketName}/${s3Key}`,
        file_size_bytes: file_buffer.length,
        mime_type,
        s3_bucket: this.bucketName,
        s3_key: s3Key,
        sha256_hash: fileHash,
        metadata: {
          ...metadata,
          uploaded_at: new Date().toISOString(),
        },
      });

      return vendorDocument;
    } catch (error) {
      logger.error('Error uploading document to S3:', error);
      throw error;
    }
  }

  /**
   * Generate presigned URL for secure document download
   * @param options Presigned URL configuration
   * @returns Presigned URL (expires in 1 hour by default)
   */
  async getPresignedDownloadUrl(options: PresignedUrlOptions): Promise<string> {
    const { document_id, expires_in_seconds = 3600 } = options;

    try {
      // Get document record
      const document = await VendorDocument.findById(document_id);
      if (!document) {
        throw new Error('Document not found');
      }

      // Verify document exists in S3
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: document.s3_key,
      });

      await this.s3Client.send(headCommand);

      // Generate presigned URL
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: document.s3_key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, getCommand, {
        expiresIn: expires_in_seconds,
      });

      logger.info(`Presigned URL generated for document: ${document_id}`);

      return presignedUrl;
    } catch (error) {
      logger.error('Error generating presigned URL:', error);
      throw error;
    }
  }

  /**
   * Delete document from S3 and database
   * @param document_id Document ID to delete
   */
  async deleteDocument(document_id: string): Promise<void> {
    try {
      // Get document record
      const document = await VendorDocument.findById(document_id);
      if (!document) {
        throw new Error('Document not found');
      }

      // Delete from S3
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: document.s3_key,
      });

      await this.s3Client.send(deleteCommand);

      logger.info(`Document deleted from S3: ${document.s3_key}`);

      // Delete database record
      await VendorDocument.findByIdAndDelete(document_id);

      logger.info(`Document record deleted: ${document_id}`);
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Verify document integrity by comparing hash
   * @param document_id Document ID to verify
   * @returns True if hash matches, false otherwise
   */
  async verifyDocumentIntegrity(document_id: string): Promise<boolean> {
    try {
      // Get document record
      const document = await VendorDocument.findById(document_id);
      if (!document) {
        throw new Error('Document not found');
      }

      // Download file from S3
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: document.s3_key,
      });

      const response = await this.s3Client.send(getCommand);
      const fileBuffer = await this.streamToBuffer(response.Body as any);

      // Calculate current hash
      const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Compare with stored hash
      const isValid = currentHash === document.sha256_hash;

      if (!isValid) {
        logger.warn(`Document integrity check failed for: ${document_id}`);
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying document integrity:', error);
      return false;
    }
  }

  /**
   * Helper: Convert stream to buffer
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * List all documents for a vendor
   * @param vendor_id Vendor ID
   * @returns Array of vendor documents
   */
  async listVendorDocuments(vendor_id: string): Promise<any[]> {
    try {
      const documents = await VendorDocument.find({ vendor_id }).sort({
        created_at: -1,
      });

      return documents;
    } catch (error) {
      logger.error('Error listing vendor documents:', error);
      throw error;
    }
  }

  /**
   * Get document metadata without downloading
   * @param document_id Document ID
   * @returns Document metadata
   */
  async getDocumentMetadata(document_id: string): Promise<any> {
    try {
      const document = await VendorDocument.findById(document_id);
      if (!document) {
        throw new Error('Document not found');
      }

      // Get S3 metadata
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: document.s3_key,
      });

      const s3Metadata = await this.s3Client.send(headCommand);

      return {
        document_id: document._id,
        vendor_id: document.vendor_id,
        document_type: document.document_type,
        file_name: document.file_name,
        file_size_bytes: document.file_size_bytes,
        mime_type: document.mime_type,
        created_at: document.created_at,
        s3_metadata: {
          last_modified: s3Metadata.LastModified,
          etag: s3Metadata.ETag,
          server_side_encryption: s3Metadata.ServerSideEncryption,
        },
      };
    } catch (error) {
      logger.error('Error getting document metadata:', error);
      throw error;
    }
  }
}

export default new DocumentUploadService();
