require('dotenv').config()
const path = require('path');

const express = require('express');
const app = express();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const cookieParser = require('cookie-parser'); 
app.use(cookieParser());


const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI);
const userModel = require('./model/user');
const postModel = require('./model/post');
const { connect } = require('http2');
const user = require('./model/user');

app.set("view engine","ejs");
app.use(express.json());
app.use(express.urlencoded({extended:true}));

function isloggedin(req,res,next){
    if(req.cookies.token==="") return res.redirect('/login');

    const data = jwt.verify(req.cookies.token,process.env.jwtsecret);
    req.user = data;
    next();
}

app.get('/',async (req,res)=>{
    const allUsers = await userModel.find();
    res.render("index",{allUsers});
})

app.get('/login',async (req,res)=>{
    const count = {valid:true};
    const allUsers = await userModel.find();
    res.render("login",{count,allUsers});
})

app.post('/login',async (req,res)=>{
    const {email,password} = req.body;
    const count = {valid:true};
    const user = await userModel.findOne({email});
    const allUsers = await userModel.find();
    if(!user){count.valid=false; return res.status(500).render('login',{count,allUsers});}

    bcrypt.compare(password,user.password,(err,result)=>{
        if(result){
            const token = jwt.sign({email,userid:user._id},process.env.jwtsecret);
            res.cookie("token",token);
            res.status(200).redirect('/profile');
        }
        else res.status(500).render('login',{count,allUsers});
    })
})

app.get('/logout',(req,res)=>{
    res.cookie("token","");
    res.redirect('/login');
})

app.get('/profile',isloggedin,async (req,res)=>{
    const user = await userModel.findOne({email:req.user.email});
    await user.populate('posts');
    const allUsers = await userModel.find();
    res.render("profile",{user, allUsers});
})
app.get('/like/:id',isloggedin,async (req,res)=>{
    const post = await postModel.findOne({_id:req.params.id}).populate('user');
    const userid = post.user._id;

    if(post.likes.indexOf(req.user.userid)===-1){
        post.likes.push(req.user.userid);
    }
    else{
        post.likes.splice(post.likes.indexOf(req.user.userid),1);
    }

    await post.save();
    if(String(userid)!==String(req.user.userid)) res.redirect('/user/'+userid);
    else res.redirect('/profile');
})
app.get('/edit/:id',isloggedin,async (req,res)=>{
    const post = await postModel.findOne({_id:req.params.id}).populate('user');
    res.render("edit",{post});
})

app.post('/update/:id',isloggedin,async (req,res)=>{
    const post = await postModel.findOneAndUpdate({_id:req.params.id},{content:req.body.content});
    res.redirect('/profile');
})

app.get('/user/:id',isloggedin,async (req,res)=>{
    const allUsers = await userModel.find();
    const user = await userModel.findOne({_id:req.params.id}).populate('posts');
    const curruser = req.user;

    res.render("profile2",{user,curruser,allUsers});
})
app.post('/post',isloggedin,async (req,res)=>{
    const user = await userModel.findOne({email:req.user.email});
    const post = await postModel.create({
        user:user._id,
        content:req.body.content
    })

    user.posts.push(post._id);
    await user.save();
    res.redirect('/profile');
})
app.post('/register',async (req,res)=>{
    const {email,password,username,name,age} = req.body;

    const user = await userModel.findOne({email});
    if(user) return res.status(500).send('User already exist!!');

    bcrypt.genSalt(10,(err,salt)=>{
        bcrypt.hash(password,salt,async (err,hash)=>{
            const user = await userModel.create({
                username,
                email,
                age,
                name,
                password:hash
            });
            const token = jwt.sign({email,userid:user._id},process.env.jwtsecret);
            res.cookie("token",token);
            res.redirect('/profile');
        });

    })

})

app.listen(3000);