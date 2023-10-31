import { transporter } from '../app.js';
import DocumentModel from '../models/Document.js';
import UserModel from '../models/User.js';
import InviteModel from '../models/invite.js';
import { HTTP_RES_CODE, USER_STATUS } from '../shared/constants.js';
import { createAuthToken, sendEmail } from '../shared/helpers.js';

const inviteRouter = (fastify, opts, done) => {
    fastify.get('/mail', async (request, reply) => {
        try {
            await transporter.sendMail({
                from: process.env.SERVER_MAIL_ADDRESS,
                to: 'montgasam@gmail.com',
                subject: `invited you to his document.`,
                text: `OK`,
            });

            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'no invitation found',
            });
        } catch (error) {
            console.log('invite@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: { error },
                message: 'Unexpected Server Error Occured.',
            });
        }
    });
    fastify.get('/:token', async (request, reply) => {
        try {
            const invite = await InviteModel.findOne({
                token: request.params.token,
            });
            if (invite) {
                if (invite.status === 'done') {
                    return reply.send({
                        code: HTTP_RES_CODE.ERROR,
                        data: {
                            user: invite.contributor,
                            document: invite.document,
                            creator: invite.creator,
                        },
                        message: '',
                    });
                }
                const user = await UserModel.findById(invite.contributor._id);
                const document = await DocumentModel.findById(
                    invite.document._id,
                );
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        user,
                        document,
                        creator: invite.creator,
                    },
                    message: '',
                });
            }
            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'no invitation found',
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

    fastify.post('/:token', async (request, reply) => {
        try {
            const invite = await InviteModel.findOne({
                token: request.params.token,
            });
            if (invite) {
                if (invite.status === 'done') {
                    return reply.code(404).send({
                        code: HTTP_RES_CODE.ERROR,
                        message: '',
                    });
                }
                invite.status = 'done';
                invite.save();
                const user = await UserModel.findById(invite.contributor._id);
                user.status = USER_STATUS.ACTIVE;
                user.password = request.body.password;
                user.save();
                const document = await DocumentModel.findById(
                    invite.document._id,
                );
                if (
                    !document.contributors.find(
                        (item) => item._id === invite.contributor._id,
                    )
                )
                    document.contributors = [...document.contributors, user];
                document.invites = document.invites.map((item) => ({
                    ...item,
                    status:
                        item._id.toString() ===
                        invite.contributor._id.toString()
                            ? 'accept'
                            : item.status,
                    date:
                        item._id.toString() ===
                        invite.contributor._id.toString()
                            ? new Date()
                            : item.date,
                }));
                document.save();
                const serviceToken = createAuthToken(user);
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        serviceToken,
                        user,
                        document,
                    },
                    message: '',
                });
            }
            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'no invitation found',
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
