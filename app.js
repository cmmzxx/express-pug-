const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const sqlite = require('sqlite')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const svgCaptcha = require('svg-captcha')
const multer = require('multer')
const upload = multer({dest: path.join(__dirname, './avatars')})

const app = express()
const port = 3000
const dbPromise = sqlite.open('./bbs.db', {Promise})
let db
svgCaptcha.options = {
  width: 180,
  height: 40,
  fontSize: 26,
  size: 4,
  noise: 1,
  background: '#cc9966'
}

app.set('views', './templates')
app.locals.pretty = true
app.use('/static', express.static('./static'))
app.use('/avatars', express.static('./avatars'))
app.use(cookieParser('sadafaddsf'))
app.use(session({
  secret: 'sadafaddsf',
  resave: true,
  saveUninitialized: true
}))
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

app.use(function sessionMiddleware(req, res, next) {
  if (!req.cookies.sessionId) {
    res.cookie('sessionId', Math.random().toString(16).substr(2))
  }
  next()
})

app.use(async function (req, res, next) {
  req.user = await db.get('SELECT * FROM users WHERE id=?', req.signedCookies.userId)
  if (!req.user) {
    req.user = {}
  }
  next()
})
// 主页
app.get('/', async (req, res, next) => {
  let posts = await db.all('SELECT posts.*,avatar,name FROM posts JOIN users ON posts.userid=users.id WHERE posts.id < 11')
  res.render('index.pug', {posts, user: req.user})
})
// 修改头像
app.post('/changeAvatar', upload.any(), async (req, res, next) => {
  if (req.files[0]) {
    await db.run('UPDATE users SET avatar=? WHERE id=?',req.files[0].filename, req.user.id)
    res.json({code:200, msg: '头像上传成功','avatar':req.files[0].filename})
  } else {
    res.json({code: 0, msg: '头像上传失败'})
  }
})

// 个人页面
app.get('/user/:userId', async (req, res, next) => {
  let userId = Number(req.params.userId)
  let loginUser
  if (req.signedCookies.userId) {
    loginUser = req.user
  } else {
    loginUser = await db.get('SELECT name,avatar FROM users WHERE id=?', userId)
  }
  let userPosts = await db.all('SELECT * FROM posts WHERE userId=?', userId)
  // 不需要comment.userId
  let userComments = await db.all(`SELECT comments.*,title FROM comments JOIN posts ON comments.postId=posts.id WHERE comments.userId=?`, userId)
  if (loginUser) {
    res.render('user.pug', {
      loginUser,
      user: req.user,
      posts: userPosts,
      userComments
    })
  } else {
    res.render('user.pug', {user: null})
  }
})

// 帖子的页面
app.get('/post/:postId' ,async (req, res, next) => {
  let postId = Number(req.params.postId)
  // 注释掉的是我的很挫的...
  // let post = await db.get('SELECT * FROM posts WHERE id=?', postId)
  // 查到了post的全部信息和user的name字段
  let post = await db.get('SELECT posts.*, name,avatar FROM posts JOIN users ON posts.userId=users.id WHERE posts.id=?', postId)
  if (post) {
    // let user = await db.get('SELECT * FROM users WHERE id=?', post.userId)
    let comments = await db.all('SELECT comments.*, name,avatar FROM comments JOIN users ON comments.userId=users.id WHERE comments.postId=?', postId)
    if (req.user) {
      res.render('post.pug',{post, comments, user: req.user})
    } else {
      res.render('post.pug',{post, comments, user: {id: -1}})
    }
  } else {
    res.set('Content-Type', 'text/html; charset=UTF-8')
    res.end('您查看的帖子不存在或者已经被删除')
  }
})

// 评论页面
app.post('/add-comment', async (req, res, next) => {
  let postId = Number(req.body.postId)
  let userId = req.signedCookies.userId
  if (userId) {
    await db.run('INSERT INTO comments (postId, userId, content, timestamp) VALUES (?,?,?,?)',postId, userId, req.body.content, Date.now())
    res.redirect('/post/' + postId)
  } else {
    res.set('Content-Type', 'text/html; charset=UTF-8')
    res.end('您还未登陆，不能发表评论')
  }
})

// 发表帖子
app.route('/add-post')
  .get(async (req, res, next) => {
    res.render('add-post.pug', {user: req.user})
    res.end('ok')
  })
  .post(async (req, res, next) => {
    if (req.signedCookies.userId) {
      let id = Number(req.signedCookies.userId)
      await db.run('INSERT INTO posts (userId, title, content, timestamp) VALUES (?,?,?,?)',id, req.body.title, req.body.content, Date.now())
      let postId = await db.get('SELECT last_insert_rowid()')
      res.redirect('/post/' + postId['last_insert_rowid()'])
    } else {
      res.set('Content-Type', 'text/html; charset=UTF-8')
      res.end('您还未登陆，不能发帖')
    }
  })

// 注册页面
app.route('/register')
  .get((req, res, next) => {
    res.render('register.pug', {user: req.user})
  })
  .post(upload.single('avatar'), async (req, res, next) => {
    let serverCaptcha = req.session.captcha.toUpperCase()
    let clientCaptcha = req.body.captcha.toUpperCase()
    if (serverCaptcha !== clientCaptcha) {
      res.json({
        code:0,
        msg: '验证码输入错误'
      })
      return
    }
    let user = await db.get('SELECT * FROM users WHERE name=?', req.body.username)
    if (user) {
      res.json({
        code:0,
        msg:'用户名已被注册'
      })
    } else {
      await db.run('INSERT INTO users (name, password) VALUES (?,?)', req.body.username, req.body.password)
      res.json({
        code: 200,
        msg: ''
      })
    }
  })

// 删除帖子
app.get('/deletePost/:postId', async (req, res, next)=> {
  let postId = Number(req.params.postId)
  let userId = Number(req.signedCookies.userId)
  let post = await db.get('SELECT * FROM posts WHERE id=?', postId)
  if (post) {
    if (post.userId === userId) {
      await db.run('DELETE FROM posts WHERE id=?', postId)
    }
    let url = req.headers.referer.match(/user/g) ? req.headers.referer : '/'
    res.redirect(url)
  } else {
    res.set('Content-Type', 'text/html; charset=UTF-8')
    res.end('未找到您想要删除的内容')
  }
})
// 删除评论
app.get('/deleteComment/:commentId', async (req, res, next) => {
  let commentId = Number(req.params.commentId)
  let userId = Number(req.signedCookies.userId)
  let comment = await db.get('SELECT * FROM comments WHERE id=?', commentId)
  let post = await db.get('SELECT * FROM posts WHERE userId=?', userId)
  console.log(comment.userId === userId || userId === post.userId)
  if (comment.userId === userId || userId === post.userId) {
    await db.run('DELETE FROM comments WHERE id=?', commentId)
    res.redirect(req.headers.referer)
  } else {
    res.redirect('/')
  }
})

// 验证码获取
app.get('/captcha', async (req, res, next) => {
  let captcha = svgCaptcha.create();
  req.session.captcha = captcha.text
  res.type('svg')
  res.status(200).send(captcha.data)
})
// 登陆页面
app.route('/login')
  .get((req, res, next) => {
    res.render('login.pug', {user: req.user})
  })
  .post(async (req, res, next) => {
    let serverCaptcha = req.session.captcha.toUpperCase()
    let clientCaptcha = req.body.captcha.toUpperCase()
    if (serverCaptcha !== clientCaptcha) {
      res.json({
        code:0,
        msg: '验证码输入错误'
      })
      return
    } else {
      let user = await db.get('SELECT * FROM users WHERE users.name=? and users.password=?', req.body.username, req.body.password)
      if (user) {
        res.cookie('userId', user.id, {
          signed: true
        })
        res.json({
          code: 200,
          msg: ''
        })
      } else {
        res.json({
          code: 0,
          msg: '账号或密码有误'
        })
      }
    }
  })
// 退出登陆
app.get('/logout', (req, res, next) => {
  res.clearCookie('userId')
  res.redirect('/')
})

;(async function () {
  db = await dbPromise
  app.listen(port, () => {
    console.log('server listening on port:' + port)
  })
}())
