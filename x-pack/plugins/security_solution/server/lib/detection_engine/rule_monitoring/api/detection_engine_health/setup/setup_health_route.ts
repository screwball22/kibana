/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { transformError } from '@kbn/securitysolution-es-utils';
import { buildSiemResponse } from '../../../../routes/utils';
import type { SecuritySolutionPluginRouter } from '../../../../../../types';

import { SETUP_HEALTH_URL } from '../../../../../../../common/api/detection_engine/rule_monitoring';

/**
 * Similar to the "setup" command of beats, this endpoint installs resources
 * (dashboards, data views, etc) related to rule monitoring and Detection Engine health,
 * and can do any other setup work.
 */
export const setupHealthRoute = (router: SecuritySolutionPluginRouter) => {
  router.post(
    {
      path: SETUP_HEALTH_URL,
      validate: {},
      options: {
        tags: ['access:securitySolution'],
      },
    },
    async (context, request, response) => {
      const siemResponse = buildSiemResponse(response);

      try {
        const ctx = await context.resolve(['securitySolution']);
        const healthClient = ctx.securitySolution.getDetectionEngineHealthClient();

        await healthClient.installAssetsForMonitoringHealth();

        return response.ok({ body: {} });
      } catch (err) {
        const error = transformError(err);
        return siemResponse.error({
          body: error.message,
          statusCode: error.statusCode,
        });
      }
    }
  );
};
