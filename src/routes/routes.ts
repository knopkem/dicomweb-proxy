import { fetchMeta } from '../dimse/fetchMeta';
import { FastifyInstance } from 'fastify';
import { doFind } from '../dimse/findData';
import { QUERY_LEVEL } from '../dimse/querLevel';
import { doWadoRs } from '../dimse/wadoRs';
import { doWadoUri } from '../dimse/wadoUri';
import { LoggerSingleton } from '../utils/logger';

import deepmerge from 'deepmerge';
import combineMerge from '../utils/combineMerge';

const options = { arrayMerge: combineMerge };
const logger = LoggerSingleton.Instance;

interface IParamsStudy {
  studyInstanceUid: string;
}

interface IParamsSeries extends IParamsStudy {
  seriesInstanceUid: string;
}

interface IParamsImage extends IParamsSeries {
  sopInstanceUid: string;
}

interface IQueryImage {
  studyUID: string;
  seriesUID: string;
  objectUID: string;
}

interface QueryParams {
  [key: string]: string;
}

module.exports = function (server: FastifyInstance, opts: unknown, done: () => void) {
  server.get<{
    Querystring: QueryParams;
  }>('/rs/studies', async (req, reply) => {
    try {
      const { query } = req;
      const json = deepmerge.all(await doFind(QUERY_LEVEL.STUDY, query), options);
      reply.send(json);
    } catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsStudy;
    Querystring: QueryParams;
  }>('/rs/studies/:studyInstanceUid', async (req, reply) => {
    const { params } = req;
    const { studyInstanceUid } = params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer); 
    } catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsStudy;
  }>('/rs/studies/:studyInstanceUid/pixeldata', async (req, reply) => {
    const { studyInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, dataFormat: 'pixeldata' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    }
    catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsStudy;
  }>('/rs/studies/:studyInstanceUid/rendered', async (req, reply) => {
    const { studyInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, dataFormat: 'rendered' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    }
    catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsStudy;
  }>('/rs/studies/:studyInstanceUid/thumbnail', async (req, reply) => {
    const { studyInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, dataFormat: 'thumbnail' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    }
    catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsStudy;
    Querystring: QueryParams;
  }>('/rs/studies/:studyInstanceUid/metadata', async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;

    try {
      const json = deepmerge.all(await doFind(QUERY_LEVEL.SERIES, query), options);
      reply.send(json);
    } catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsStudy;
    Querystring: QueryParams;
  }>('/rs/studies/:studyInstanceUid/series', async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;

    try {
      const json = deepmerge.all(await doFind(QUERY_LEVEL.SERIES, query), options);
      reply.send(json);
    } catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

    server.get<{
      Params: IParamsSeries;
      Querystring: QueryParams;
    }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid', async (req, reply) => {
      const { params } = req;
      const { studyInstanceUid, seriesInstanceUid } = params;
  
      try {
        const rsp = await doWadoRs({ studyInstanceUid, seriesInstanceUid });
        reply.header('Content-Type', rsp.contentType);
        reply.send(rsp.buffer);
      } catch (error) {
        logger.error(error);
        reply.send(500);
      }
    });
  
  //------------------------------------------------------------------

  server.get<{
    Params: IParamsSeries;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/pixeldata', async (req, reply) => {
    const { studyInstanceUid, seriesInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, seriesInstanceUid, dataFormat: 'pixeldata' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    }
    catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsSeries;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/rendered', async (req, reply) => {
    const { studyInstanceUid, seriesInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, seriesInstanceUid, dataFormat: 'rendered' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    }
    catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsSeries;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/thumbnail', async (req, reply) => {
    const { studyInstanceUid, seriesInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, seriesInstanceUid, dataFormat: 'thumbnail' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    }
    catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsSeries;
    Querystring: QueryParams;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances', async (req, reply) => {
    const { query, params } = req;
    query.StudyInstanceUID = params.studyInstanceUid;
    query.SeriesInstanceUID = params.seriesInstanceUid;

    try {
      const json = deepmerge.all(await doFind(QUERY_LEVEL.IMAGE, query), options);
      reply.send(json);
    } catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsSeries;
    Querystring: QueryParams;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata', async (req, reply) => {
    const { studyInstanceUid, seriesInstanceUid } = req.params;
    const { query } = req;
    query.StudyInstanceUID = studyInstanceUid;
    query.SeriesInstanceUID = seriesInstanceUid;

    try {
      const rsp = await fetchMeta(query, studyInstanceUid, seriesInstanceUid);
      reply.send(rsp);
    } catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsImage;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/pixeldata', async (req, reply) => {
    const { studyInstanceUid, seriesInstanceUid, sopInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, seriesInstanceUid, sopInstanceUid, dataFormat: 'pixeldata' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    }
    catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsImage;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/rendered', async (req, reply) => {
    const { studyInstanceUid, seriesInstanceUid, sopInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, seriesInstanceUid, sopInstanceUid, dataFormat: 'rendered' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    }
    catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsImage;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/thumbnail', async (req, reply) => {
    const { studyInstanceUid, seriesInstanceUid, sopInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, seriesInstanceUid, sopInstanceUid, dataFormat: 'thumbnail' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    }
    catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsImage;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/frames/:frame', async (req, reply) => {
    const { studyInstanceUid, seriesInstanceUid, sopInstanceUid } = req.params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, seriesInstanceUid, sopInstanceUid, dataFormat: 'pixeldata' });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    } catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Params: IParamsImage;
    Querystring: QueryParams;
  }>('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid', async (req, reply) => {
    const { params } = req;
    const { studyInstanceUid, seriesInstanceUid, sopInstanceUid } = params;

    try {
      const rsp = await doWadoRs({ studyInstanceUid, seriesInstanceUid, sopInstanceUid });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    } catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  //------------------------------------------------------------------

  server.get<{
    Querystring: IQueryImage;
  }>('/wadouri', async (req, reply) => {
    const { studyUID, seriesUID, objectUID } = req.query;

    try {
      const rsp = await doWadoUri({ studyInstanceUid: studyUID, seriesInstanceUid: seriesUID, sopInstanceUid: objectUID });
      reply.header('Content-Type', rsp.contentType);
      reply.send(rsp.buffer);
    } catch (error) {
      logger.error(error);
      reply.send(500);
    }
  });

  done();
};

//------------------------------------------------------------------
