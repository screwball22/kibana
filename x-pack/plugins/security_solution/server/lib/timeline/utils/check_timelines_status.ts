/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import path, { join, resolve } from 'path';
import * as rt from 'io-ts';
import type { TimelineSavedObject, ImportTimelinesSchema } from '../../../../common/api/timeline';
import {
  TimelineSavedToReturnObjectRuntimeType,
  ImportTimelinesSchemaRt,
} from '../../../../common/api/timeline';

import { unionWithNullType } from '../../../../common/utility_types';

import type { FrameworkRequest } from '../../framework';

import { getExistingPrepackagedTimelines } from '../saved_object/timelines';

import { loadData, getReadables } from './common';

export const checkTimelineStatusRt = rt.type({
  timelinesToInstall: rt.array(unionWithNullType(ImportTimelinesSchemaRt)),
  timelinesToUpdate: rt.array(unionWithNullType(ImportTimelinesSchemaRt)),
  prepackagedTimelines: rt.array(unionWithNullType(TimelineSavedToReturnObjectRuntimeType)),
});

export type CheckTimelineStatusRt = rt.TypeOf<typeof checkTimelineStatusRt>;

export const getTimelinesToUpdate = (
  timelinesFromFileSystem: ImportTimelinesSchema[],
  installedTimelines: TimelineSavedObject[]
): ImportTimelinesSchema[] => {
  return timelinesFromFileSystem.filter((timeline) =>
    installedTimelines.some((installedTimeline) => {
      return (
        timeline.templateTimelineId === installedTimeline.templateTimelineId &&
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        timeline.templateTimelineVersion! > installedTimeline.templateTimelineVersion!
      );
    })
  );
};

export const getTimelinesToInstall = (
  timelinesFromFileSystem: ImportTimelinesSchema[],
  installedTimelines: TimelineSavedObject[]
): ImportTimelinesSchema[] => {
  return timelinesFromFileSystem.filter(
    (timeline) =>
      !installedTimelines.some(
        (installedTimeline) => installedTimeline.templateTimelineId === timeline.templateTimelineId
      )
  );
};

export const checkTimelinesStatus = async (
  frameworkRequest: FrameworkRequest,
  filePath?: string,
  fileName?: string
): Promise<CheckTimelineStatusRt | Error> => {
  let readStream;
  let timeline: {
    totalCount: number;
    timeline: TimelineSavedObject[];
  };
  const dir = resolve(
    join(
      __dirname,
      filePath ?? '../../detection_engine/prebuilt_rules/content/prepackaged_timelines'
    )
  );
  const file = fileName ?? 'index.ndjson';
  const dataPath = path.join(dir, file);

  try {
    readStream = await getReadables(dataPath);
    timeline = await getExistingPrepackagedTimelines(frameworkRequest);
  } catch (err) {
    return {
      timelinesToInstall: [],
      timelinesToUpdate: [],
      prepackagedTimelines: [],
    };
  }

  return loadData<'utf-8', CheckTimelineStatusRt>(
    readStream,
    <T>(timelinesFromFileSystem: T) => {
      if (Array.isArray(timelinesFromFileSystem)) {
        const parsedTimelinesFromFileSystem = (timelinesFromFileSystem as readonly string[]).map(
          (t) => JSON.parse(t)
        );
        const prepackagedTimelines = timeline.timeline ?? [];
        const timelinesToInstall = getTimelinesToInstall(
          parsedTimelinesFromFileSystem,
          prepackagedTimelines
        );
        const timelinesToUpdate = getTimelinesToUpdate(
          parsedTimelinesFromFileSystem,
          prepackagedTimelines
        );

        return Promise.resolve({
          timelinesToInstall,
          timelinesToUpdate,
          prepackagedTimelines,
        });
      } else {
        return Promise.reject(new Error('load timeline error'));
      }
    },
    'utf-8'
  );
};
