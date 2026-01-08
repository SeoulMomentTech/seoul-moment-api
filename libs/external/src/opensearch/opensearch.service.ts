import { Inject, Injectable } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';

const OPENSEARCH_CLIENT = 'OPENSEARCH_CLIENT';

@Injectable()
export class OpensearchService {
  constructor(
    @Inject(OPENSEARCH_CLIENT)
    private readonly client: Client,
  ) {}

  /**
   * OpenSearch 클러스터 상태 확인
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.client.ping();
      return response.statusCode === 200;
    } catch (error) {
      console.error('OpenSearch ping failed:', error);
      return false;
    }
  }

  /**
   * 인덱스 생성
   */
  async createIndex(index: string, body?: Record<string, any>): Promise<any> {
    return await this.client.indices.create({
      index,
      body,
    });
  }

  /**
   * 인덱스 존재 여부 확인
   */
  async indexExists(index: string): Promise<boolean> {
    try {
      const response = await this.client.indices.exists({ index });
      return response.statusCode === 200;
    } catch {
      return false;
    }
  }

  /**
   * 인덱스 삭제
   */
  async deleteIndex(index: string): Promise<any> {
    return await this.client.indices.delete({ index });
  }

  /**
   * 문서 인덱싱
   */
  async indexDocument(
    index: string,
    id: string,
    body: Record<string, any>,
  ): Promise<any> {
    return await this.client.index({
      index,
      id,
      body,
      refresh: true,
    });
  }

  /**
   * 문서 조회
   */
  async getDocument(index: string, id: string): Promise<any> {
    return await this.client.get({
      index,
      id,
    });
  }

  /**
   * 문서 삭제
   */
  async deleteDocument(index: string, id: string): Promise<any> {
    return await this.client.delete({
      index,
      id,
      refresh: true,
    });
  }

  /**
   * 문서 업데이트
   */
  async updateDocument(
    index: string,
    id: string,
    body: Record<string, any>,
  ): Promise<any> {
    return await this.client.update({
      index,
      id,
      body: {
        doc: body,
      },
      refresh: true,
    });
  }

  /**
   * 검색
   */
  async search(index: string, body: Record<string, any>): Promise<any> {
    return await this.client.search({
      index,
      body,
    });
  }

  /**
   * 벌크 작업
   */
  async bulk(
    index: string,
    documents: Array<{ id: number | string; [key: string]: any }>,
  ): Promise<any> {
    const body = documents.flatMap((doc) => [
      { index: { _index: index, _id: doc.id.toString() } },
      doc,
    ]);

    return await this.client.bulk({
      body,
      refresh: true,
    });
  }

  /**
   * 클라이언트 직접 접근 (고급 기능)
   */
  getClient(): Client {
    return this.client;
  }
}
