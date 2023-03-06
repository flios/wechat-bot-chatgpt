import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { Configuration, OpenAIApi } from 'openai';
import { WechatyBuilder } from 'wechaty';

import GeneralChatMessageProcessor from './processors/GeneralChatMessageProcessor.js';

// LowDB database
// Usage:
//   db.data.xxx = xxx;
//   await db.write();
const db = new Low(new JSONFile(join(dirname(fileURLToPath(import.meta.url)), "database.json")));
await db.read();

// OpenAI initialization
const openai = new OpenAIApi(new Configuration({
    apiKey: db.data.openai.secret_key,
}));

// Processor initialization
const processors = {};

// Wechaty initialization
const wechaty = WechatyBuilder.build();
let bot_user_name = null;

// Wechaty listeners
wechaty
    .on('scan', (qrcode, status) => {
        console.log(`Scan QR Code to login: ${status}\nhttps://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`);
    })
    .on('login', (user) => {
        bot_user_name = user.name();
        console.log(`User ${user} logged in`);
    })
    .on('logout', () => {
        bot_user_name = null;
    })
    .on('message', async (message) => {
        if (!message.self() && message.room()
            && (await message.mentionSelf() ||
                (bot_user_name && (message.text() + " ").includes("@" + bot_user_name)))) {
            if (!(message.room().id in processors)) {
                processors[message.room().id] = new GeneralChatMessageProcessor(
                    openai,
                    db.data.wechat.general_chat_message.history_size,
                    db.data.wechat.general_chat_message.default_system_prompt);
                console.log(`New room: ${message.room().id}`);
            }
            if (message.text().includes("!!!RESET!!!")) {
                await processors[message.room().id].reset(message);
            } else if (message.text().includes("!!!SYSTEM!!!")) {
                await processors[message.room().id].system(message, false, bot_user_name);
            } else if (message.text().includes("!!!SYSTEMRESET!!!")) {
                await processors[message.room().id].system(message, true, bot_user_name);
            } else {
                await processors[message.room().id].process(message, bot_user_name);
            }
        }
    });

// Main
wechaty.start();
