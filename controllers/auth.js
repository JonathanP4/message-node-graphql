const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");

function errorHandler(error, next) {
    if (!error.statusCode) {
        error.statusCode = 500;
    }
    return next(error);
}

exports.signup = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const error = new Error("Vlidation failed.");
            error.statusCode = 422;
            error.data = errors.array();
            throw error;
        }
        const email = req.body.email;
        const name = req.body.name;
        const password = req.body.password;

        const hashedPassword = await bcrypt.hash(password, 12);
        console.log(hashedPassword);

        const user = new User({ email, name, password: hashedPassword });
        await user.save();

        res.status(201).json({ message: "User created!", userId: user._id });
    } catch (error) {
        errorHandler(error, next);
    }
};

exports.login = async (req, res, next) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        let loadedUser;

        const user = await User.findOne({ email });

        if (!user) {
            const error = new Error(
                "A user whit this email could not be found"
            );
            error.statusCode = 404;
            throw error;
        }
        loadedUser = user;
        const isEqual = await bcrypt.compare(password, user.password);

        if (!isEqual) {
            const error = new Error("Wrong password.");
            error.statusCode = 401;
            throw error;
        }
        const token = jwt.sign(
            {
                email: loadedUser.email,
                userId: loadedUser._id.toString(),
            },
            "Secretm1GZBGbXy0Vf6sDr",
            { expiresIn: "1h" }
        );
        res.status(200).json({ token, userId: loadedUser._id.toString() });
    } catch (error) {
        errorHandler(error, next);
    }
};
