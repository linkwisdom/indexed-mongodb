/**
 * @file 初始化IndexedDb
 * 
 * @author Liandong Liu (liuliandong01@baidu.com)
 */
define(function (require, exports, module) {
    var Deferred = require('er/deferred');
    var memset = require('./memset');
    var dbConf = require('./dbConf');

    /**
     * 事务模型
     */
    var TransactionModes = {
        READ_ONLY: 'readonly',
        READ_WRITE: 'readwrite',
        VERSION_CHANGE: 'versionchange'
    };

    /**
     * 获取索引查找条件
     */
    function getRange(condition) {
        var tp = typeof condition;
        if (tp !== 'object') {
            return IDBKeyRange.only(condition); 
        }

        if (condition['$gt']) {
            return IDBKeyRange.lowerBound(condition['$gt'], true);
        } else if (condition['$gte']) {
            return IDBKeyRange.lowerBound(condition['$gte']);
        } else if (condition['$lt']) {
            return IDBKeyRange.upperBound(condition['$lt'], true);
        } else if (condition['$lte']) {
            return IDBKeyRange.upperBound(condition['$lte']);
        } else if (condition['$eq']) {
            return IDBKeyRange.only(condition['eq']);
        }
        return IDBKeyRange.lowerBound(1);
    }

    exports.request = function (request) {
        var deferred = new Deferred();

        request.onsuccess = function (e) {
            deferred.resolve(e.target.result);
        };

        request.onerror = function (e) {
            deferred.fail(e.target);
        };

        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            exports.createStore({ db: db });
            deferred.resolve(db);
        };

        return deferred;
    };

    /**
     * 连接两次异步请求
     */
    exports.pipe = function (chain) {
        return new Deferred();
    };

    /**
     * 打开数据库
     */
    exports.open = function (context) {
        var request = null;

        if (context.version) {
            request = window.indexedDB.open(
                context.name,
                context.version
            );
        } else {
             request = window.indexedDB.open(
                context.name
            );
        }
        
        return exports.request(request);
    };
    
    /**
     * 为数据库批量创建库
     */
    exports.createStore = function (context) {
        var stores = context.stores || Object.create(dbConf);

        stores.forEach(function (store) {
            var indecies = store.indecies || [];
            var objectStore = context.db.createObjectStore(store.name, {
                keyPath: store.key,
                id: 0,
                autoIncrement: false
            });

            indecies.forEach(function (indexName) {
                objectStore.createIndex(indexName, indexName, { unique: false });
            });
        });
    };

    /**
     * 通过主键id获取元素
     */
    exports.getItem = function (primaryId, context) {
        var storeName = context.storeName;
        var db = context.db;
                  
        if (db.objectStoreNames.contains(storeName)) {
            var transaction = db.transaction(storeName, TransactionModes.READ_ONLY); 
            var store = transaction.objectStore(storeName);
            return exports.request(store.get(primaryId)); 
        }
    };

    /**
     * 删除记录
     * - 通过主键id删除元素
     */
    exports.removeItem = function (primaryId, context) {
        var storeName = context.storeName;
        var db = context.db;
                  
        if (db.objectStoreNames.contains(storeName)) {
            var transaction = db.transaction(storeName, TransactionModes.READ_WRITE); 
            var store = transaction.objectStore(storeName);
            var request = store.delete(primaryId);
            return exports.request(request); 
        }
    }

    /**
     * 删除记录
     * - 通过查询条件删除元素
     * - 不建议本地记录删除；删除策略改为标识移除
     */
    exports.remove = function (selector, context) {
        var deferred = new Deferred();
        var list = selector;

        if (!Array.isArray(selector)) {
            var result = [];
            var request = exports.find(
                selector, context,
                function (e) {
                    var cursor = e.target.result;
                    if (cursor && cursor.value) {
                        result.push(cursor.value);
                        cursor.delete();
                        cursor.continue();
                    } else {
                        deferred.resolve(result);
                    }
                }
            );

            if (context.display) {
                exports.display(deferred, context);
            }
            return deferred;
        }
        

        var storeName = context.storeName;
        var db = context.db;
        var deferred = new Deferred();
                  
        if (db.objectStoreNames.contains(storeName)) {
            var transaction = db.transaction(storeName, TransactionModes.READ_WRITE); 
            var store = transaction.objectStore(storeName);
            var request = null;
            var result = [];

            list.forEach(function (item) {
                if (item.planid) {
                    request = store.delete(item.planid);
                    result.push(item.planid);
                }
            });

            if (request) {
                // 只用最后一次请求
                request.onsuccess = function () {
                    deferred.resolve(result);
                };
            }
        }

        if (context.display) {
            exports.display(deferred, context);
        }

        return deferred;
    }

    /**
     * 显示数据 (异步响应数据)
     */
    exports.display = function (source, option) {
        option = option || {};
        if (Deferred.isPromise(source)) {
            return source.then(function (data) {
                if (option.fields) {
                    // 不建议切字段
                    data = memset(data).find({}, option);
                }
                console.table(data);
                return data;
            });
        }

        if (option.fields) {
            // 不建议切字段
            data = memset(data).find({}, option);
        }
        console.table(source);
    };

    /**
     * 插入数据
     * - 支持单条或多条数据插入
     */
    exports.insert = function (sets, context) {
        var deferred = new Deferred();
        sets = [].concat(sets);
        var storeName = context.storeName;
        var transaction = context.db.transaction(
            storeName, TransactionModes.READ_WRITE); 
        var store = transaction.objectStore(storeName);
        console.log('insert length = %s', sets.length);
        console.time('insertloop');
        console.time('insert');
        
        transaction.onabort  =
        transaction.oncomplete = function (e) { 
            console.timeEnd('insert');
            deferred.resolve(sets);
        };

        for(var i = 0; i < sets.length; i++) {
            store.add(sets[i]);
        }
        console.timeEnd('insertloop');

        if (context.display) {
            exports.display(deferred, context);
        }
    };

    /**
     * 查询元素
     * - 结合索引查找和内存查找机制
     * - 第一个记录用索引查找（后续改为智能匹配索引）
     */
    exports.find = function (selector, context, callback) {
        var deferred = new Deferred();
        var storeName = context.storeName;
        var transaction = context.db.transaction(
            [storeName], TransactionModes.READ_WRITE); 
        var store = transaction.objectStore(storeName);

        var keys = Object.keys(selector);

        // 第一个过滤条件必须是索引
        if (!store.indexNames.contains(keys[0])) {
            throw new Error('the first filter-key must be indexed key');
        }

        var filters = keys.map(function (key) {
            return getRange(selector[key]);
        });

        var index = store.index(keys[0]);
        var request = index.openCursor(filters[0]);

        // 自定义游标处理
        if (callback) {
            request.onsuccess = callback;
            return request;
        }

        var result = [];
        var count = context.count || Number.MAX_VALUE;
        console.time('index-find');
        console.time('index-sort');

        // 游标触发下次请求
        request.onsuccess = function (e) {
            if (result.length == 0) {
                console.timeEnd('index-sort');
            }
            
            var cursor = e.target.result;
            if (cursor && cursor.value && result.length < count) {
                result.push(cursor.value);
                cursor.continue();
            } else {
                console.timeEnd('index-find');
                deferred.resolve(result);
            }
        };

        // memset-find 内存集合查找
        var promise = deferred.then(function (data) {
            console.log('memset-find length = %s', data.length);
            console.time('memset-find');

            if (keys.length > 1) {
                var key = keys.unshift();;
                delete selector[key];
                data = memset(data).find(selector, { fields: context.fields });
            }
            console.timeEnd('memset-find');
            return data;
        });

        if (promise && context.display) {
            exports.display(promise);
        }

        return promise;
    };
});
