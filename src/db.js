/**
 * ajax - service 定义
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 * 
 */
define( function (require, exports) {
    var idb = require('./imdb');
    function getConnection(level, option) {
        var userid = option.userid || '1389';

        var dbName = userid + '_db' ;
        var chain = idb.open({
            name: dbName,
            version: option.version
        });

        return chain.then(
            function (db) {
                return {
                    db: db,
                    storeName: level
                }
            }
        );
    }
    
    function getFinder(level, userid) {
        return function (selector, params) {
            params = params || {};
            var promise = idb.pipe(chain);
            var chain = getConnection(
                params.level || level, 
                {
                    userid: params.userid || userid
                }
            );

            chain.then(function (context) {
                for (var k in params) {
                    context[k] = params[k];
                }

                var state;
                if (typeof selector == 'string'
                    || typeof selector == 'number') {
                    // id 查找
                    state = idb.get(selector, context);
                } else {
                    // 索引查找
                    state = idb.find(selector, context)
                }
                
                // 只有请求数据回来后才算完成
                state.then(function (data) {
                    promise.resolve(data);
                    return data;
                });

                return state;
            });

            return promise;
        };
    }

    function getRemover(level, userid) {
        return function (selector, params) {
            params = params || {};
            var promise = idb.pipe(chain);
            var chain = getConnection(
                params.level || level, 
                {
                    userid: params.userid || userid
                }
            );

            chain.then(function (context) {
                for (var k in params) {
                    context[k] = params[k];
                }

                var state;
                if (typeof selector !== 'object') {
                    // id 查找
                    state = idb.removeItem(selector, context);
                } else {
                    // 索引查找
                    state = idb.remove(selector, context)
                }
                
                // 只有请求数据回来后才算完成
                state.then(function (data) {
                    promise.resolve(data);
                    return data;
                });

                return state;
            });

            return promise;
        };
    }

    function getUpdater(level, userid) {
        return function (selector, data) {
            data = data || selector;
            var chain = getConnection(level, { userid: userid })
            chain.then(function (context) {
                // 如果data是数组则任务是插入操作
                if (Array.isArray(data)) {
                    return idb.insert(data, context);
                } else {
                    return idb.update(selector, data, context);
                }
            });
            return chain;
        };
    }

    function getInserter(level, userid) {

        return function (data, params) {
            data = data || selector;
            var chain = getConnection(level, { userid: userid });

            chain.then(function (context) {
                for (var k in params) {
                    context[k] = params[k];
                }

                return idb.insert(data, context);
            });

            return chain;
        };
    }

    function getIniter(level, userid) {
        return function (selector, data) {
            data = data || selector;
            var chain = getConnection(level, { userid: userid })
            chain.then(function (context) {
                // 如果data是数组则任务是插入操作
                if (Array.isArray(data)) {
                    return idb.insert(context, data);
                } else {
                    return idb.update(context, selector, data);
                }
            });
            return chain;
        };
    }

    function createStore(level, userid) {
        return function (storeName, options) {
            var chain = getConnection(level, { userid: options.userid, version: options.version })
            chain.then(function (context) {
               idb.createStore(
                   context, 
                   options || { keyPath: level + 'id'　}
               );
               return context;
            });
            return chain;
        };
    }

    return {
        open: getConnection,
        create: createStore('account'),
        account: {
            init: getIniter('account'),
            find: getFinder('account'),
            update: getInserter('account'),
            insert: getUpdater('account')
        },
        plan: {
            find: getFinder('plan'),
            update: getUpdater('plan'),
            insert: getInserter('plan'),
            remove: getRemover('plan')
        },
        unit: {
            find: getFinder('unit'),
            update: getInserter('unit'),
            insert: getInserter('unit'),
            remove: getRemover('unit')
        }
    };
});
