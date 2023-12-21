import UserModel from '../models/User.js';
import { HTTP_RES_CODE, USER_STATUS } from '../shared/constants.js';
import { getFrontendPath } from '../shared/env.js';
import { createAuthToken } from '../shared/helpers.js';

const googleOAuth2Routes = (fastify, options, done) => {
    fastify.get('/google/callback', async function (request, reply) {
        try {
            const { token } =
                await fastify.GoogleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
                    request,
                );

            reply.redirect(
                getFrontendPath() + 'oauth?access_token=' + token.access_token,
            );
        } catch (error) {
            console.log(error);
            reply.redirect(getFrontendPath());
        }
    });
    fastify.post('/login', async function (request, reply) {
        try {
            const { accessToken } = request.body;
            const response = await fetch(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                },
            );
            const userInfo = await response.json();
            const user = await UserModel.findOne({ email: userInfo.email });

            if (user) {
                if (user.status !== 'active') {
                    return reply.send({
                        code: HTTP_RES_CODE.ERROR,
                        data: { status: user.status },
                    });
                }
                const token = createAuthToken(user);
                const currentDate = new Date();
                user.lastLogonTime = currentDate.toString();
                await user.save();
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        serviceToken: token,
                        user,
                    },
                });
            } else {
                const _user = new UserModel(userInfo);
                const currentDate = new Date();
                _user.lastLogonTime = currentDate.toString();
                _user.status = USER_STATUS.ACTIVE;
                _user.countryCode = '0';
                _user.mobilePhone = '0';
                _user.workPhone = '0';
                _user.password = 'Welcome123.!@#';
                await _user.save();
                const token = createAuthToken(_user);
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        serviceToken: token,
                        user: _user,
                    },
                });
            }
        } catch (error) {
            console.log(error);
            return reply.send({
                code: HTTP_RES_CODE.ERROR,
                data: {
                    messages: error.messages,
                },
            });
        }
    });

    done();
};

export default googleOAuth2Routes;
