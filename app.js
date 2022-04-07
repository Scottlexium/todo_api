const dotenv = require('dotenv')
const express = require('express')
const { auth } = require('express-openid-connect');
const os = require('os')
const app = express();
const bodyParser = require('body-parser');
var admin = require("firebase-admin");
const cookieParser = require("cookie-parser");
const jwt = require('jsonwebtoken');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('./todo-service.json');
const { v4: uuidv4 } = require('uuid');
const randomeID = uuidv4();
dotenv.config();
const methodOverride = require('method-override');
// app.use(methodOverride('_method'))

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();


app.use(express.json());
app.use(cookieParser());
app.set('views', 'views');
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
const PORT = process.env.PORT || 3000;



const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SECRET || 'cmwiomnionownccionwcwcnmwcwcmwc',
    baseURL: process.env.BASEURL || 'http://localhost:3000',
    clientID: process.env.CLIENTID || '9T8OEoVBbLFPdbLXcMgEXkqRPjUFpcCV',
    issuerBaseURL: process.env.ISSUERBASEURL || 'https://dev-7pl535xp.us.auth0.com'
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

app.listen(PORT, () => {
    console.log(`listening on http://localhost:${PORT}`);
})




const initDb = db.collection('users');
// req.isAuthenticated is provided from the auth router
// decoding function

let globalToken = null;
const tokenCb = function (req, res, next) {
    const preToken = req.cookies.access_token;
    const decodedCookieToken = jwt.decode(preToken);
    globalToken = decodedCookieToken;
    console.log('all route decoded id => ', decodedCookieToken);
    next();
}


app.get('/', (req, res) => {
    res.redirect(req.oidc.isAuthenticated() ? '/home' : '/login');
});
// app.get('/logout', (req, res) => {
//     res.redirect('/logout')
// })
app.get('/home', tokenCb, async (req, res) => {
    const userRef = req.oidc.idTokenClaims;
    const data = {
        first_name: userRef.given_name,
        last_name: userRef.family_name,
        nick_name: userRef.nickname,
        name: userRef.name,
        email: userRef.email,
    };
    let token = null;
    let resId = null;
    const queryRef = await initDb.where('email', '==', userRef.email).get();
    queryRef.forEach((doc) => {
        resId = doc.id;
        token = jwt.sign({ id: doc.id }, "YOUR_SECRET_KEY");
    })
    if (queryRef.empty) {
        const dataRef = await db.collection('users').add(data);
        console.log('added ', dataRef.id)
        console.log('User doesnt exist so is being created')
        token = jwt.sign({ id: dataRef.id }, "YOUR_SECRET_KEY");
    } else {
        console.log('id => ', resId)
        console.log('User exists so no need to create')
    }
    // fetch task list
    let taskData = [];
    const taskRef = await db
        .collection(`users/${resId}/tasks`)
        .get();
    taskRef.forEach((task) => {
        taskData.push(task.data());
    })
    console.log(taskData);

    // return
    return res
        .cookie("access_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        }).render('index', { user: userRef, task: taskData });

})
app.get('/task', tokenCb, (req, res) => {
    console.log('see', globalToken);
    res.render('task');
})
app.get('/fetchTaskList', (req, res) => {
    console.log('ok')
    res.status(200).json({ data: 'done' })
})
app.get('/settings', tokenCb, (req, res) => {
    res.render('settings');
})
app.post('/addTask', tokenCb, async (req, res) => {
    console.log(req.body);
    const addTask = ({
        taskId: randomeID,
        task_title: req.body.add_task_title,
        task_time: req.body.add_task_time,
        task_date: req.body.add_task_date,
        task_summary: req.body.add_task_summary,
    });
    const noteLimit = 10;
    const checkTask = await db.collection('users').doc(globalToken.id).collection('tasks').get();;
    if (checkTask._size == noteLimit) {
        res.status(200).json({ limit: true})
    } else {
        const dataRef = await db.collection('users').doc(globalToken.id).collection('tasks').add(addTask);
        console.log(dataRef.id);
        res.status(200).json({ saved: true })
    }
    console.log('current tasks =>', checkTask._size)

})
app.post('/edit/:id', tokenCb, async (req, res) => {
    console.log('body => ', req.body);
    console.log(req.params.id)
    const task_time = req.body.time;
    const task_date = req.body.date;
    const task_summary = req.body.summary;
    let taskId = null;
    const taskRef = await db
        .collection(`users/${globalToken.id}/tasks`)
        .where('taskId', '==', `${req.params.id}`)
        .get();
    taskRef.forEach((task) => {
        taskId = task.id;
        console.log((task.id));
    })
    const tRef = await db.collection('users').doc(globalToken.id)
        .collection('tasks').doc(taskId).set({
            task_time,
            task_date,
            task_summary
        }, { merge: true });
    console.log(tRef)
    res.redirect('/home')
});
app.delete('/delete/:id', tokenCb, async (req, res) => {
    console.log(req.params.id)
    console.log('Search for=> ', req.params.id)
    let taskId = null;
    const taskRef = await db
        .collection(`users/${globalToken.id}/tasks`)
        .where('taskId', '==', `${req.params.id}`)
        .get();
    taskRef.forEach((task) => {
        taskId = task.id;
        console.log((task.id));
    })
    const tRef = await db.collection('users').doc(globalToken.id)
        .collection('tasks').doc(taskId).delete();
    console.log('deleting'.tRef)
    res.status(200).json({ delete: 'successfull' })
})
// addTask
