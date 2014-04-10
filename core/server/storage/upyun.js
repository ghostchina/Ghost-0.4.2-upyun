// # Local File System Image Storage module
// The (default) module for storing images, using the local file system

var _       = require('lodash'),
    express = require('express'),
    fs      = require('fs-extra'),
    nodefn  = require('when/node/function'),
    path    = require('path'),
    when    = require('when'),
    errors  = require('../errorHandling'),
    config = require('../config'),
    baseStore   = require('./base'),
    crypto = require('crypto'),
    upyunConfig  = config().upyun,
    UPYun        = require('./upyun/upyun').UPYun,
    upyun = new UPYun(upyunConfig.bucketname, upyunConfig.username, upyunConfig.password),

    upyunStore;

upyunStore = _.extend(baseStore, {
    // ### Save
    // Saves the image to storage (the file system)
    // - image is the express image object
    // - returns a promise which ultimately returns the full url to the uploaded image
    'save': function (image) {
        var saved = when.defer(),
            md5sum = crypto.createHash('md5'),
            ext = path.extname(image.name),
            targetDirRoot = upyunConfig.root,
            targetFilename;

        var savedpath = path.join(config().paths.imagesPath, image.name);

        nodefn.call(fs.copy, image.path, savedpath).then(function(){
        	return nodefn.call(fs.readFile, savedpath);
        }).then(function(data){
        	console.log('Readed:',data.length,image.path, savedpath);
            md5 = md5sum.update(data).digest('hex');

            targetFilename = path.join(targetDirRoot, md5.replace(/^(\w{1})(\w{2})(\w+)$/, '$1/$2/$3')) + ext;
            targetFilename = targetFilename.replace(/\\/g, '/');

            return nodefn.call(upyun.writeFile, targetFilename, data, true);
        }).then(function () {
            return nodefn.call(fs.unlink, savedpath).then(function(){
            	return nodefn.call(fs.unlink, image.path);
            }).otherwise(errors.logError);
        }).then(function () {
            // prefix + upyunFilename
            var fullUrl = upyunConfig.prefix + targetFilename;
            return saved.resolve(fullUrl);
        }).otherwise(function (e) {
            errors.logError(e);
            return saved.reject(e);
        });

        return saved.promise;
    },

    'exists': function (filename) {
        // fs.exists does not play nicely with nodefn because the callback doesn't have an error argument
        var done = when.defer();

        fs.exists(filename, function (exists) {
            done.resolve(exists);
        });

        return done.promise;
    },

    // middleware for serving the files
    'serve': function () {
        var ONE_HOUR_MS = 60 * 60 * 1000,
            ONE_YEAR_MS = 365 * 24 * ONE_HOUR_MS;

        // For some reason send divides the max age number by 1000
        return express['static'](config().paths.imagesPath, {maxAge: ONE_YEAR_MS});
    }
});

module.exports = upyunStore;
