const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");

const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

function errorHandler(error, next) {
    if (!error.statusCode) {
        error.statusCode = 500;
    }
    return next(error);
}

function clearImage(filePath) {
    filePath = path.join(__dirname, "..", filePath);
    fs.unlink(filePath, (error) => console.log(error));
}

exports.getPosts = async (req, res, next) => {
    try {
        const currentPage = req.query.page;
        const perPage = 2;
        let totalItems;

        const count = await Post.find().countDocuments();
        totalItems = count;

        const posts = await Post.find()
            .populate("creator")
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * perPage)
            .limit(perPage);

        res.status(200).json({
            message: "Post fetching succeeded!",
            posts,
            totalItems,
        });
    } catch (error) {
        errorHandler(error, next);
    }
};

exports.createPost = async (req, res, next) => {
    try {
        const result = validationResult(req);

        if (!result.isEmpty()) {
            const error = new Error("Validation failed, invalid input data.");
            error.statusCode = 422;
            throw error;
        }
        if (!req.file) {
            const error = new Error("No image provided.");
            error.statusCode = 422;
            throw error;
        }

        const imageUrl = req.file.path.replace("\\", "/");
        const title = req.body.title;
        const content = req.body.content;
        let creator;

        const post = new Post({
            title: title,
            content: content,
            imageUrl: imageUrl,
            creator: req.userId,
        });
        await post.save();
        const user = await User.findById(req.userId);
        creator = user;
        user.posts.push(post);

        await user.save();

        io.getIO().emit("posts", {
            action: "create",
            post: {
                ...post._doc,
                creator: { _id: req.userId, name: user.name },
            },
        });

        res.status(201).json({
            msg: "Post added succesfully!",
            post,
            creator: { _id: creator._id, name: creator.name },
        });
    } catch (error) {
        console.log(error);
        errorHandler(error, next);
    }
};

exports.getPost = async (req, res, next) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId);

        if (!post) {
            const error = new Error("Could not find post.");
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({ message: "Post fetched.", post });
    } catch (error) {
        errorHandler(error, next);
    }
};

exports.updatePost = async (req, res, next) => {
    try {
        const result = validationResult(req);

        if (!result.isEmpty()) {
            const error = new Error("Validation failed, invalid input data.");
            error.statusCode = 422;
            throw error;
        }
        const postId = req.params.postId;
        let imageUrl = req.body.image;
        const title = req.body.title;
        const content = req.body.content;

        if (req.file) {
            imageUrl = req.file.path.replace("\\", "/");
        }
        if (!imageUrl) {
            const error = new Error("No file picked.");
            error.statusCode = 422;
            throw error;
        }
        const post = await Post.findById(postId).populate("creator");

        if (!post) {
            const error = new Error("Could not find post.");
            error.statusCode = 404;
            throw error;
        }
        if (post.creator._id.toString() !== req.userId) {
            const error = new Error("Not authorized.");
            error.statusCode = 403;
            throw error;
        }
        if (imageUrl !== post.imageUrl) {
            clearImage(post.imageUrl);
        }
        post.title = title;
        post.imageUrl = imageUrl;
        post.content = content;

        await post.save();
        io.getIO().emit("posts", { action: "update", post });
        res.status(200).json({ message: "Post updated!", post });
    } catch (error) {
        errorHandler(error, next);
    }
};

exports.deletePost = async (req, res, next) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId);

        if (!post) {
            const error = new Error("Could not find post.");
            error.statusCode = 404;
            throw error;
        }

        if (post.creator.toString() !== req.userId) {
            const error = new Error("Not authorized.");
            error.statusCode = 403;
            throw error;
        }

        clearImage(post.imageUrl);

        await Post.findByIdAndDelete(postId);

        const user = await User.findById(req.userId);
        user.posts.pull(postId);
        await user.save();

        io.getIO().emit("posts", { action: "delete", post: postId });

        res.status(200).json({ message: "Post deleted" });
    } catch (error) {
        errorHandler(error, next);
    }
};

exports.getStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        const status = user.status;

        res.status(200).json({ message: "Status fetched", status });
    } catch (error) {
        errorHandler(error, next);
    }
};

exports.updateStatus = async (req, res, next) => {
    try {
        const newStatus = req.body.status;
        const user = await User.findById(req.userId);

        if (!user) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        user.status = newStatus;
        await user.save();
        const status = user.status;

        res.status(200).json({ message: "Status fetched", status });
    } catch (error) {
        errorHandler(error, next);
    }
};
