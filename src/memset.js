define( function (require, exports) {

    function Memset(set) {
        var me = this;

        if (this.constructor !== Memset) {
            me = new Memset(set);
        }

        me.set = set;

        return me;
    }

    Memset.prototype.cut = function (item, fields) {
        var newObj = {};
        fields.forEach(function (field) {
            newObj[field] = item[field];
        });
        return newObj;
    };
   

    Memset.prototype.find = function (selector, condition) {
        var me = this;
        var conds = this.parseQuery(selector);
        var list = condition.fields ? [] : false;

        var flist = this.set.filter(function (item) {
            var match = true;
            match = match && !conds.some(function (cond) {
                var key = cond.field;
                return !me.match(cond.operand, item[key], cond.value);
            });

            if (match && list) {
                list.push(me.cut(item, condition.fields));
            }
            return match;
        });

        return list || flist;
    };

    Memset.prototype.parseQuery = function (query) {
        var res = [];
        if (!Array.isArray(query)) {
            query = [query];
        }

        query.forEach(function (cond) {
            // Set key
            var keys = Object.keys(cond);
            keys.forEach(function (key) {
                if (typeof cond[key] === 'object') {
                    var condition = Object.keys(cond[key]);
                    res.push({
                        field: key,
                        operand: condition[0],
                        value: cond[key][condition]
                    });
                } else {
                    // Direct (==) matching
                    res.push({
                        field: key,
                        operand: '$eq',
                        value: cond[key]
                    });
                }
            });
        });
        return res;
    };

    Memset.prototype.match = function (opt, val1, val2) {
        switch (opt) {
            case '$gt':
                return val1 > val2;
            case '$lt':
                return val1 < val2;
            case '$gte':
                return val1 >= val2;
            case '$lte':
                return val1 <= val2;
            case '$ne':
                return val1 != val2;
            case '$eq':
                return val1 == val2;
            case '$like':
                return new RegExp(val2, 'i').test(val1);
        };
    };

    window.Memset = Memset;

    return Memset;
});
