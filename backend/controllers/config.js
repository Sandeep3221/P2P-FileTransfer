exports.getConfig = (req, res) => {
    res.json({
        turnUrl: process.env.TURN_URL || '',
        turnUsername: process.env.TURN_USERNAME || '',
        turnPassword: process.env.TURN_PASSWORD || '',
        maxMessageSize: 65536
    });
};
