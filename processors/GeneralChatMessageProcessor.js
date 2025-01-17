import FixedSizeQueue from '../utils/FixedSizeQueue.js';

export default class GeneralChatMessageProcessor {
    constructor(openai, history_size, system_prompt) {
        this.openai = openai;
        this.history_size = history_size;
        this.history = new FixedSizeQueue(history_size);
        this.default_system_prompt = system_prompt;
        this.system_queries = [{ "role": "system", "content": system_prompt }];
    }

    format_exc(error) {
        return "> " + error.toString().replaceAll("\n", "\n> ");
    }

    async build_bot_reply(name, request, reply) {
        return `\n${reply}`;
    }

    async process(message, bot_user_name) {
        const text = bot_user_name ? message.text().replaceAll(`@${bot_user_name}`, "").trim() : message.text().trim();
        const current_query = { "role": "user", "content": text };
        try {
            const response = await this.openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: this.system_queries.concat(this.history.list(), current_query),
            });
            const response_message = response.data.choices[0].message;
            const response_query = { "role": response_message.role, "content": response_message.content };
            this.history.push(current_query);
            this.history.push(response_query);
            const room = message.room()
            const talker = message.talker()
            if (room){
                await room.say(await this.build_bot_reply(
                    message.talker().name(), text, response_message.content.trim()), message.talker());
            } else {
                await talker.say(await this.build_bot_reply(
                    message.talker().name(), text, response_message.content.trim()));
            }
             
            return true;
        } catch (error) {
            const room = message.room()
            const talker = message.talker()
            const content = `遇到未知错误，请检查是否文本过长，或重试一次！\n> 错误信息：\n${this.format_exc(error)}`
            if (room){
                await room.say(await this.build_bot_reply(
                    message.talker().name(), text, content), message.talker());
            } else {
                await talker.say(await this.build_bot_reply(
                    message.talker().name(), text, content));
            }
        }
        return false;
    }

    async system(message, reset, bot_user_name) {
        const text = bot_user_name ? message.text().replaceAll(`@${bot_user_name}`, "").trim() : message.text().trim();
        if (reset) {
            this.system_queries = [{ "role": "system", "content": this.default_system_prompt }];
            const room = message.room()
            const talker = message.talker()
            const content = `已经重置系统提示。现在的系统提示为：\n${this.system_queries[0].content}`
            if (room){
                await room.say(await this.build_bot_reply(
                    message.talker().name(), text, content), message.talker());
            } else {
                await talker.say(await this.build_bot_reply(
                    message.talker().name(), text, content));
            }

        } else {
            const system_prompt = text.replaceAll("!!!SYSTEM!!!", "").trim();
            this.system_queries = [{ "role": "system", "content": system_prompt }];
            const room = message.room()
            const talker = message.talker()
            const content = `已经成功设置系统提示。现在的系统提示为：\n${this.system_queries[0].content}`
            if (room){
                await room.say(await this.build_bot_reply(
                    message.talker().name(), text, content), message.talker());
            } else {
                await talker.say(await this.build_bot_reply(
                    message.talker().name(), text, content));
            }
        }
    }

    async reset(message) {
        const text = message.text().trim(); // not used yet -- filter bot_user_name if necessary later.
        await this.history.clear();
        const room = message.room()
        const talker = message.talker()
        const content = "已经重置会话历史。我已经忘记了我们之前的对话。现在可以重新开始向我提问了。"
        if (room){
            await room.say(await this.build_bot_reply(
                message.talker().name(), text, content), message.talker());
        } else {
            await talker.say(await this.build_bot_reply(
                message.talker().name(), text, content));
        }

    }
}