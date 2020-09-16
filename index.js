const fs = require('fs'),
    path = require('path'),
    axios = require('axios'),
    xml2js = require('xml2js'),
    prbar = require('progress'),
    colors = require('colors'),
    readline = require('readline'),
    terminalImage = require('terminal-image');

if (!fs.existsSync('database.json')) fs.writeFileSync("database.json", "[]");
if (!fs.existsSync('images')) fs.mkdirSync("images");

let runned = false,
    tags,
    nsfw,
    last = "",
    repeat = JSON.parse(fs.readFileSync("database.json"));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Бинды: \n\ts - пристоновить/запустить скачивание\n\td - удалить последнюю картинку \nНапиши теги через запятую: '.green, (tag) => {
    tags = tag.split(", ").join("+").split(",").join("+").split(" ").join("_");
    rl.question('18+ (Да/Нет): '.red, (answer) => {
        nsfw = (answer.toLowerCase().indexOf("д") > -1 || answer.toLowerCase().indexOf("y") > -1) ? true : false;
        run();
        keyPressEvent();
    });
});

function run() {
    runned = true;
    page(0);
    async function page(page_id) {
        let res = await axios.get(`https://konachan.com/post.xml?page=${page_id}&tags=${tags}`)
        xml2js.parseString(res.data, function (err, result) {
            let all = result.posts;
            if (all['$'].count == 0) return console.log("Что ты гуглишь, мудила!".red)
            next(0);
            function next(id) {
                if (id == all.post.length) return page(page_id + 1);

                let img = all.post[id]['$'];
                let type = (img.file_url.indexOf(".png") > -1) ? ".png" : ".jpg";

                if ((img.rating == `q` || img.rating == `e`) && !nsfw) return next(id + 1);

                if (repeat.toString().indexOf(`${img.id}${type}`) > -1) return next(id + 1);

                downloadImage(img.file_url, img.id, type).then(async fin => {
                    console.log(`${img.id} Downloaded`.green);
                    repeat.push(`${img.id}${type}`);
                    fs.writeFileSync("database.json", JSON.stringify(repeat));
                    console.log(await terminalImage.file(`images/${img.id}${type}`, {width: "100%"}));
                    last = `${img.id}${type}`;
                    if (runned) next(id + 1);
                });
            }
        });
    }
}

async function downloadImage(url, name, type) {
    console.log('Подключение …'.green);

    const { data, headers } = await axios({ url, method: 'GET', responseType: 'stream' });
    const totalLength = headers['content-length'];

    console.log(`Начало загрузки: ${name} \t Вес: ${(totalLength / 1024 / 1024).toPrecision(3)} мб`.rainbow);
    const progressBar = new prbar(':bar :percent Остальлось: :etas', {
        width: 40,
        complete: '\u001b[42m \u001b[0m',
        incomplete: '\u001b[41m \u001b[0m',
        renderThrottle: 1,
        total: parseInt(totalLength)
    });

    const writer = fs.createWriteStream(`images/${name}${type}`);

    data.on('data', (chunk) => progressBar.tick(chunk.length));
    data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    })
}

function keyPressEvent() {
    process.stdin.on('keypress', function (s, key) {
        if (key.name == "d" || key.name == "в") {
            if (last != "") {
                console.clear();
                repeat = repeat.filter((el) => { return el != last });
                fs.unlinkSync(`images/${last}`);
                fs.writeFileSync("database.json", JSON.stringify(repeat));
                console.log(`\n${last} была удалена!`.red);
            }
        }
        if (key.name == "s" || key.name == "ы") {
            console.clear();
            if (runned) {
                runned = false;
                console.log(`\nЗагрузка будет остановлена после завершения скачивания!`.red);
            } else {
                runned = true;
                console.log(`\nЗагрузка продолжается!`.green);
                run(tags);
            }
        }
        return;
    })
}