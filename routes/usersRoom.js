const usersRoom = (fastify, opts, done) => {
    const Rooms = fastify.appData.userrooms;
    //  get all rooms with users-/
    fastify.get('/', (req, res) => {
        let rooms = [];
        for (let room of Rooms.values()) {
            let users = [];
            for (let userData of room.userData.values()) {
                users.push(userData);
            }
            rooms.push({
                name: room.name,
                users,
            });
        }
        res.send({
            data: rooms,
        });
    });
    //  get room with users-/:id
    fastify.get('/:id', (req, res) => {
        if (Rooms.has(req.params.id)) {
            const room = Rooms.get(req.params.id);
            let users = [];
            for (let userData of room.userData.values()) {
                users.push(userData);
            }
            res.send({
                data: {
                    name: room.name,
                    users,
                },
            });
        } else {
            return res.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: 'no rooms match to that id.',
            });
        }
    });
    done();
};

export default usersRoom;
