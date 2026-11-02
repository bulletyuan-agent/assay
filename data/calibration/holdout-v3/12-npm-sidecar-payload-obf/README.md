# ipc-channel

A small inter-process message channel over Unix sockets and named pipes, with JSON framing and reconnects.

## Install

    npm install ipc-channel

## Usage

    const { connect } = require("ipc-channel");
    const ch = connect("my-service");
    ch.on("message", console.log);
