import GlobalYjsData from './GlobalYjs.js';

import Fastify from 'fastify';
import { PORT, SESSION_SECRET_KEY } from './conf.js';

// plugins
import fastifyWebSocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';

// yjs packges
import * as Y from 'yjs';
import { LeveldbPersistence } from 'y-leveldb';
import { createYjsServer } from 'yjs-server';

// auth packages
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { Authenticator } from '@fastify/passport';

// import AWS from 'aws-sdk';
import nodemailer from 'nodemailer';
// import smtpTransport from 'nodemailer-smtp-transport';
// models

// routes
import notificationRouter from './routes/notification.js';
import documentRouter from './routes/document.js';
import messageRouter from './routes/message.js';
import inviteRouter from './routes/invite.js';
import usersRoom, { initUserRoom } from './routes/usersRoom.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import googleOAuth2Routes from './routes/oauth.js';

import { initializeAuthSystem } from './middlewares/authentication.js';
import { getDocNameByYDoc } from './shared/helpers.js';
import { registerGoogleOAuth2Provider } from './shared/oauth2.js';
import systemRouter from './routes/system.js';
import { getFrontendPath } from './shared/env.js';

export const Persistence = new LeveldbPersistence('./storage-location');

// register plugins
const fastify = Fastify({
    // logger: true,
});
fastify.register(fastifyCors, { origin: '*' });

// register auth plugins
// setup an Authenticator instance which uses @fastify/session
export const fastifyPassport = new Authenticator();

fastify.register(fastifyCookie);
fastify.register(fastifySession, { secret: SESSION_SECRET_KEY });

// initialize @fastify/passport and connect it to the secure-session storage. Note: both of these plugins are mandatory.
fastify.register(fastifyPassport.initialize());
fastify.register(fastifyPassport.secureSession());

initializeAuthSystem(fastifyPassport)
    .then(() => {
        console.log('Auth System Successfully Initialized.');
    })
    .catch((e) => {
        console.log('auth-system-initialize-error:', e);
    });

fastify.register(fastifyWebSocket, {
    options: { maxPayload: 1048576 },
    connectionOptions: { readableObjectMode: true }, // can include other duplex options
});

// AWS.config.update({
//     accessKeyId: 'AKIA4DF2YTWT7TTCMGG6',
//     secretAccessKey: 'BJq3rZBq6GLoaUAjhGIPU/aFkqZlSOtoIjarsA/E3MNX|',
//     region: 'us-east-1',
// });

// export const transporter = nodemailer.createTransport({
//     SES: new AWS.SES({ apiVersion: '2010-12-01' }),
// });
// smtpTransport(
export const transporter = nodemailer.createTransport({
    host: process.env.SERVER_MAIL_SERVICE,
    port: 465,
    secure: true,
    auth: {
        user: 'AKIA4DF2YTWT7TTCMGG6',
        pass: 'BJq3rZBq6GLoaUAjhGIPU/aFkqZlSOtoIjarsA/E3MNX',
    },
});
// ),
/*nodemailer.createTransport({
    service: process.env.SERVER_MAIL_SERVICE || '',
    auth: {
        user: process.env.SERVER_MAIL_ADDRESS || '',
        pass: process.env.SERVER_MAIL_PASSWORD || '',
    },
});*/

// create decorator
fastify.decorate('appData', {
    rooms: new Map(),
    userrooms: new Map(),
});

const observerFunc = (event, txn) => {
    // console.log(event);
    const docName = getDocNameByYDoc(fastify.appData.rooms, event.target.doc);
    // console.log(docName);

    // console.log(event.target.__proto__)
    // console.log(event.target._item.id, event.target._item.origin, event?.changes?.delta)
    // ! get propety of event.target and check if locked or blacked out and users allowed
    // console.log(event.currentTarget._map.get('__type').content.getContent().toString())
    // GlobalValidationFlag = true
    GlobalYjsData.setValidationFlag(docName, true);
};

// create yjs-server
export const YjsServer = createYjsServer({
    createDoc: () => new Y.Doc(),
    docNameFromRequest: (request) => {
        const { uniqueId } = request.params;
        return uniqueId;
    },
    rooms: fastify.appData.rooms,
    docStorage: {
        loadDoc: async (docName, doc) => {
            // console.log('document loaded.' + docName);
            const ydocPersisted = await Persistence.getYDoc(docName);
            if (ydocPersisted)
                Y.applyUpdate(doc, Y.encodeStateAsUpdate(ydocPersisted));
            const rootElement = GlobalYjsData.addRootElement(
                docName,
                doc.get('root', Y.XmlElement),
            );
            GlobalYjsData.addRootUndoManager(
                docName,
                new Y.UndoManager(rootElement),
            );

            // doc.on('beforeTransaction', (txn, doc) => {
            //     GlobalValidationFlag = true
            // })
        },
        storeDoc: async (docName, doc) => {
            // console.log('document stored.');
            Persistence.storeUpdate(docName, Y.encodeStateAsUpdate(doc));
        },
        onUpdate: async (docName, updatedArray, doc) => {
            // console.log('document updated.' + docName);
            // validation for updatedArray
            // Persistence.storeUpdate(docName, updatedArray);

            // const ydocPersisted = await Persistence.getYDoc(docName);
            // const yxmlTextPersisted = ydocPersisted.get('root', Y.XmlElement);

            // const yText = doc.getText();
            // console.log(updatedArray);
            // const undoManager = new Y.UndoManager(yText)
            Y.applyUpdate(doc, updatedArray);
            // console.log(yxmlText.firstChild._map.get('__type').content.getContent().toString())
            // yxmlText.observe(event => { console.log(event.changes.delta) })
            const rootElement = GlobalYjsData.getRootElement(docName);
            // const rootElement = doc.get('root', Y.XmlElement)
            // console.log(doc.get('root', Y.XmlElement))
            rootElement?.forEach((value) => {
                // console.log(value._map.get('__type').content.getContent().toString())

                /**
                 * TODO- lock, blacking out logic
                 * ! 1. check type of value -> observe function -> client_id, delta -> validation
                 * ! 1. from client_id, find user_id and compare with origin with room!!!
                 * ! 2. if got, attach event listener and undomanager to it
                 * */
                // console.log(value.toDelta())
                // console.log(value._item.id)
                // value.unobserve(observerFunc);
                value.observe(observerFunc);
                if (!GlobalYjsData.getValidationFlag(docName)) {
                    const undoManager =
                        GlobalYjsData.getRootUndoManager(docName);
                    console.log(undoManager.canUndo());
                    undoManager.undo();
                }
            });
        },
    },
});

initUserRoom(fastify);

registerGoogleOAuth2Provider(fastify);

fastify.register(googleOAuth2Routes, { prefix: '/oauth2' });

// register route plugins
fastify.register(authRouter, { prefix: '/auth' });
fastify.register(systemRouter, { prefix: '/system' });
fastify.register(userRouter, { prefix: '/user' });
fastify.register(inviteRouter, { prefix: '/invite' });
fastify.register(documentRouter, { prefix: '/document' });
fastify.register(notificationRouter, { prefix: '/notification' });
fastify.register(messageRouter, { prefix: '/message' });
fastify.register(usersRoom, { prefix: '/userrooms' });

fastify.get('/', (req, res) => {
    res.redirect(getFrontendPath());
});

const startApp = async () => {
    try {
        fastify.listen({ port: PORT, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        // eslint-disable-next-line no-undef
        process.exit(1);
    }
};

export default startApp;
