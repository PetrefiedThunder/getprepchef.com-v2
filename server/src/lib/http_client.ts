import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import logger from './logger';

/**
 * HTTP Client wrapper around Axios
 * Provides centralized configuration, logging, and error handling
 */

export class HttpClient {
  private client: AxiosInstance;

  constructor(baseURL?: string, timeout: number = 30000) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PrepChef/1.0',
      },
    });

    // Request interceptor (logging)
    this.client.interceptors.request.use(
      (config) => {
        logger.debug({
          msg: 'HTTP request',
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
        });
        return config;
      },
      (error) => {
        logger.error({
          msg: 'HTTP request error',
          error: error.message,
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor (logging)
    this.client.interceptors.response.use(
      (response) => {
        logger.debug({
          msg: 'HTTP response',
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error({
          msg: 'HTTP response error',
          status: error.response?.status,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  /**
   * POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  /**
   * PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }
}

// Default client instance
export const httpClient = new HttpClient();
