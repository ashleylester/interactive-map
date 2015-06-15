var express = require('express');
var app = express();
var http = require('http');

// Creates a server over HTTP with an express.js framework
var server = http.createServer(app);

// Serves content from the public folder, root is auto-wired to index.html
app.use(express.static(__dirname + '/public'));

server.listen(3000);
