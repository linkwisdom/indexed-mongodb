indexed-mongodb
===============
> 采用mongodb的语法，promise异步化风格的异步化调用indexedb; 让indexedb使用更方便

> using indexeddb with a mongodb-like fashion;

```js
  var def = db.plan.find(
      {
          planid: { $gte: 1000 },
          planname: { $like: '鲜花' }
      },
      {
          fields: [ 'planid', 'planname', 'shows', 'clks' ],
          sortOrder: 'asc',
          sortField: 'clks'
      }
  );
  
  // display
  def.then(function (data) {
      console.table(data);
  });
```



