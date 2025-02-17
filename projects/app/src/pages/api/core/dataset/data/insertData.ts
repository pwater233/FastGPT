/* 
  insert one data to dataset (immediately insert)
  manual input or mark data
*/
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { connectToDatabase } from '@/service/mongo';
import { withNextCors } from '@fastgpt/service/common/middle/cors';
import { SetOneDatasetDataProps } from '@/global/core/api/datasetReq';
import { countPromptTokens } from '@/global/common/tiktoken';
import { getVectorModel } from '@/service/core/ai/model';
import { hasSameValue } from '@/service/core/dataset/data/utils';
import { insertData2Dataset } from '@/service/core/dataset/data/controller';
import { authDatasetCollection } from '@fastgpt/service/support/permission/auth/dataset';
import { getCollectionWithDataset } from '@fastgpt/service/core/dataset/controller';
import { authTeamBalance } from '@/service/support/permission/auth/bill';
import { pushGenerateVectorBill } from '@/service/support/wallet/bill/push';

export default withNextCors(async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    await connectToDatabase();
    const { collectionId, q, a } = req.body as SetOneDatasetDataProps;

    if (!q) {
      return Promise.reject('q is required');
    }

    if (!collectionId) {
      return Promise.reject('collectionId is required');
    }

    // 凭证校验
    const { teamId, tmbId } = await authDatasetCollection({
      req,
      authToken: true,
      authApiKey: true,
      collectionId,
      per: 'w'
    });

    await authTeamBalance(teamId);

    // auth collection and get dataset
    const [
      {
        datasetId: { _id: datasetId, vectorModel }
      }
    ] = await Promise.all([getCollectionWithDataset(collectionId), authTeamBalance(teamId)]);

    // format data
    const formatQ = q.replace(/\\n/g, '\n').trim().replace(/'/g, '"');
    const formatA = a?.replace(/\\n/g, '\n').trim().replace(/'/g, '"') || '';

    // token check
    const token = countPromptTokens(formatQ, 'system');

    if (token > getVectorModel(vectorModel).maxToken) {
      return Promise.reject('Q Over Tokens');
    }

    // Duplicate data check
    await hasSameValue({
      collectionId,
      q: formatQ,
      a: formatA
    });

    const { insertId, tokenLen } = await insertData2Dataset({
      teamId,
      tmbId,
      q: formatQ,
      a: formatA,
      collectionId,
      datasetId,
      model: vectorModel
    });

    pushGenerateVectorBill({
      teamId,
      tmbId,
      tokenLen: tokenLen,
      model: vectorModel
    });

    jsonRes<string>(res, {
      data: insertId
    });
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
});
