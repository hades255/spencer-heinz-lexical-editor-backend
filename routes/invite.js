import { transporter } from '../app.js';
import DocumentModel from '../models/Document.js';
import UserModel from '../models/User.js';
import InviteModel from '../models/invite.js';
import { HTTP_RES_CODE, USER_STATUS } from '../shared/constants.js';
import { compareDate, createAuthToken, decodeUrl } from '../shared/helpers.js';

const inviteRouter = (fastify, opts, done) => {
    fastify.get('/mail', async (request, reply) => {
        try {
            const mailOptions = {
                from: '<collaboration@pip.bio>', // sender address
                to: 'montgasam@gmail.com', // list of receivers
                subject: 'Hello', // Subject line
                text: 'Hello world', // plaintext body
                html: '<b>Hello world</b>', // html body
            };

            await transporter.sendMail(mailOptions);

            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'OK',
            });
        } catch (error) {
            console.log('email@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: { error },
                message: 'Unexpected Server Error Occured.',
            });
        }
    });

    fastify.get('/', async (request, reply) => {
        try {
            const { token } = request.query;
            const data = decodeUrl(token);
            console.log(data)
            const creator = await UserModel.findById(data.f);
            const document = await DocumentModel.findById(data.d);
            const me = document.invites.find((item) => item._id === data.t);
            let error = null;
            if (compareDate(data.x)) {
                error = 403;
            } else {
                if (document && me) {
                    const user = await UserModel.findById(me._id);
                    if (user.status === USER_STATUS.INVITED) {
                        return reply.send({
                            code: HTTP_RES_CODE.SUCCESS,
                            data: {
                                document,
                                user,
                                creator,
                            },
                            message: '',
                        });
                    }
                }
                error = 404;
            }
            console.log('invite@not user:', error);
            return reply.code(error).send({
                code: HTTP_RES_CODE.ERROR,
                data: { error },
                message: 'Unexpected Server Error Occured.',
            });
        } catch (error) {
            console.log('invite@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: 'Unexpected Server Error Occured.',
            });
        }
    });

    fastify.post('/', async (request, reply) => {
        try {
            const { password, uid, did } = request.body;
            const user = await UserModel.findById(uid);
            user.password = password;
            user.status = USER_STATUS.ACTIVE;
            user.save();
            const serviceToken = createAuthToken(user);
            return reply.send({
                code: HTTP_RES_CODE.SUCCESS,
                data: {
                    serviceToken,
                },
                message: '',
            });
        } catch (error) {
            console.log('invite@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: 'Unexpected Server Error Occured.',
            });
        }
    });
    done();
};

export default inviteRouter;
