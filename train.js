const { recurrent } = require("brain.js");
const { QuickDB } = require("quick.db");

const db = new QuickDB();

(async () => {
    let data = await db.get('trainMessages');
    let model = new recurrent.LSTM();

    console.log('Training started...');

    model.train(data, {
        iterations: 20000,
        log: true,
        logPeriod: 1000,
        errorThresh: 0.011
    });

    let testResponse = model.run('Hello! How are you?');

    console.log('Test response:', testResponse);
    console.log('Training finished!');

    await db.set('model', model.toJSON());
})();