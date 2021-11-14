import { fetchMeta } from "./dimse/fetchMeta";
import { doFind } from "./dimse/findData";
import { QUERY_LEVEL } from "./dimse/querLevel";
import { doWadoRs } from "./dimse/wadoRs";
import { doWadoUri } from "./dimse/wadoUri";
import { LoggerSingleton } from "./utils/logger";

const logger = LoggerSingleton.Instance;
module.exports = function(server: any, opts: any, done: any) {

    server.get('/rs/studies', async (req: any, reply: any) => {
        try {
            const json = await doFind(QUERY_LEVEL.STUDY, req.query);
            reply.send(json);
        } catch (error) {
            logger.error(error);
            reply.send(500);
        }

    });

    //------------------------------------------------------------------

    server.get('/rs/studies/:studyInstanceUid/metadata', async (req: any, reply: any) => {
        const { query, params } = req;
        query.StudyInstanceUID = params.studyInstanceUid;

        try {
            const json = await doFind(QUERY_LEVEL.SERIES, query);
            reply.send(json);
        } catch (error) {
            logger.error(error);
            reply.send(500);
        }

    });

    //------------------------------------------------------------------

    server.get('/rs/studies/:studyInstanceUid/series', async (req: any, reply: any) => {
        const { query, params } = req;
        query.StudyInstanceUID = params.studyInstanceUid;

        try {
            const json = await doFind(QUERY_LEVEL.SERIES, query);
            reply.send(json);
        } catch (error) {
            logger.error(error);
            reply.send(500);
        }

    });

    //------------------------------------------------------------------

    server.get('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances', async (req: any, reply: any) => {
        const { query, params } = req;
        query.StudyInstanceUID = params.studyInstanceUid;
        query.SeriesInstanceUID = params.seriesInstanceUid;

        try {
            const json = await doFind(QUERY_LEVEL.IMAGE, query);
            reply.send(json);
        } catch (error) {
            logger.error(error);
            reply.send(500);
        }
    });

    //------------------------------------------------------------------

    server.get('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata', async (req: any, reply: any) => {
        const { query, params } = req;
        const { studyInstanceUid, seriesInstanceUid } = params;
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

    server.get('/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/frames/:frame', async (req: any, reply: any) => {
        const { studyInstanceUid, seriesInstanceUid, sopInstanceUid } = req.params;

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

    server.get('/wadouri', async (req: any, reply: any) => {
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

    done()
}