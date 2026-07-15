exports.getConfig = (req, res) => {
    res.json({
        maxMessageSize: 65536
    });
};
