let users = [];

export const getUsers = () => {
    return users;
};

export const getUser = (id) => {};

export const addUser = (socket) => {
    console.log(socket.id);
    users.push(socket);
};
