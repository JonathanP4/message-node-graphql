const path = require("path");
const { v4: uuid } = require("uuid");
const bodyParser = require("body-parser");
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");

const { graphqlHTTP } = require("express-graphql");
const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");

const app = express();

require("dotenv").config;

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "images");
    },
    filename: (req, file, cb) => {
        cb(null, uuid() + file.originalname);
    },
});

const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === "image/png" ||
        file.mimetype === "image/jpg" ||
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/webp"
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

const PORT = process.env.PORT;
const URI = process.env.URI;

app.use(bodyParser.json());
app.use(
    multer({
        storage: fileStorage,
        fileFilter: fileFilter,
    }).single("image")
);
app.use("/images", express.static(path.join(__dirname, "images")));

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

app.use(
    "/graphql",
    graphqlHTTP({
        schema: graphqlSchema,
        rootValue: graphqlResolver,
        graphiql: true,
        formatError(error) {
            if (!error.originalError) {
                return error;
            }
            const data = error.originalError.data;
            const message = error.message || "An error occured";
            const status = error.originalError.code || 500;
            return {
                data,
                message,
                status,
            };
        },
    })
);

app.use((error, req, res, next) => {
    console.log(error);
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;

    res.status(status).json({ message, data });
});

(async function main() {
    try {
        await mongoose.connect(URI);
        app.listen(PORT, () => console.log("Listening on port " + PORT));
    } catch (error) {
        console.log(error);
    }
})();
