const { recurrent } = require("brain.js");
const { QuickDB } = require("quick.db");
const { readFileSync } = require("node:fs");

const db = new QuickDB();

(async () => {
    let data = readFileSync('trainMessages.json', 'utf-8');

    data = JSON.parse(data);

    let model = new recurrent.LSTM();

    console.log('Training started...');

    model.train(data, {
        iterations: 20000,
        log: true,
        logPeriod: 500,
        errorThresh: 0.011
    });

    let testResponse = model.run('Hello! How are you?');

    console.log('Test response:', testResponse);
    console.log('Training finished!');

    await db.set('model', model.toJSON());
})();