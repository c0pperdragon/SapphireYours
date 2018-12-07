'use strict';
const express = require('express');

var app = express();
app.use('/', express.static("../game/"));
app.listen(8080, "");

console.log("Webserver running, open game in browser from http://localhost:8080/launch.html");
