const express=require('express');
const app=express();

app.get('/',(req,res)=>{
res.send('Version 6 is updated');
});

app.get('/health',(req,res)=>{
res.json({status:'UP and Running'});
});

app.listen(3000);
