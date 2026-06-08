const express=require('express');
const app=express();

app.get('/',(req,res)=>{
res.send('Version 3');
});

app.get('/health',(req,res)=>{
res.json({status:'UP'});
});

app.listen(3000);
