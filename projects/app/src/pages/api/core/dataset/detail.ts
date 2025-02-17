import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { connectToDatabase } from '@/service/mongo';
import { getVectorModel } from '@/service/core/ai/model';
import { DatasetItemType } from '@/types/core/dataset';
import { authDataset } from '@fastgpt/service/support/permission/auth/dataset';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    await connectToDatabase();
    const { id: datasetId } = req.query as {
      id: string;
    };

    if (!datasetId) {
      throw new Error('缺少参数');
    }

    // 凭证校验
    const { dataset, canWrite, isOwner } = await authDataset({
      req,
      authToken: true,
      datasetId,
      per: 'r'
    });

    jsonRes<DatasetItemType>(res, {
      data: {
        ...dataset,
        tags: dataset.tags.join(' '),
        vectorModel: getVectorModel(dataset.vectorModel),
        canWrite,
        isOwner
      }
    });
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
