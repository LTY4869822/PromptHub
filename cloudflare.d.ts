declare module "cloudflare:workers" {
  export const env: Record<string, any>;
}

interface Fetcher { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> }
interface D1Database { prepare(query: string): any; batch(statements: any[]): Promise<any> }
interface R2Bucket { get(key: string, options?: any): Promise<any>; put(key: string, value: any, options?: any): Promise<any>; delete(key: string): Promise<void>; createMultipartUpload(key: string, options?: any): Promise<any>; resumeMultipartUpload(key: string, uploadId: string): any }
