(function(undefined){
    // # presto
    //
    // presto is a JavaScript utility for interacting with JSON based REST APIs
    // in a simple way.
    //
    // @param config a configuration that will overwrite the predefined configuration
    // of presto.
    // @param configurator a function that will receive presto's configuration as its
    // first and only argument and can dynamically modify it.
    //
    // presto's configuration is as follows:
    //
    //      prestoConfig = {
    //            prestoFields: {
    //                'get': {name: '$get', fn: get},
    //                'put': {name: '$put', fn: put},
    //                'post': {name: '$post', fn: post},
    //                'delete': {name: '$delete', fn: remove},
    //                'serialize': {name: '$serialize', fn: serialize},
    //                'one': {name: '$one', fn: one},
    //                'all': {name: '$all', fn: all},
    //                'path': {name: '$path'}
    //            },
    //            ajax: {
    //                dataType: 'json',
    //                contentType: 'application/json; charset=utf-8'
    //            },
    //            baseUrl: '',
    //            idAttribute: 'id',
    //            urlMap: {}
    //        };
    //
    //  * **baseUrl**: the base url for the api. All urls to fetch other objects
    //  will start with this.
    //  * **idAttribute**: the attribute that holds the id of your models. `id` by default.
    //  If your model are like:
    //
    //      {
    //          ID: '1',
    //          name: 'bob'
    //      }
    //
    //  then set idAttribute to `ID`
    //  * **urlMap**: lets you define names for specific urls.
    //
    //      var p = new presto({
    //          urlMap: {
    //              users: '/api/admin/users'
    //          }
    //      })
    //      p.$one('users') // This is now the same as doing p.$one('/api/admin/users')
    //
    //  * **ajax**: jQuery ajax config object
    //  * **prestoFields**: The name of the fields and methods that presto will augment your model
    //  with. By default they are:
    //  * * $get
    //  * * $put
    //  * * $post
    //  * * $delete
    //  * * $serialize
    //  * * $one
    //  * * $all
    //  * * $path
    //
    //  By prefixing them with a `$`, we expect that there won't be collisions with the
    //  attributes of your models in the API. However if your model contains a field named
    //  `$post`, then you could use the configurator function to rename it to `post`.
    //
    //      new presto({}, function(config){
    //          config.prestoFields.post.name = 'post'
    //      })
    //
    // @return a new presto instance
    //
    // **Example usage**:
    //
    //      var p = new presto();
    //      p.$one('users', 123).$get().then(function(user){
    //          user.name = 'bob';
    //          user.$put().then(function(user){
    //              console.log('user successfully updated');
    //              user.$delete().then(function(){
    //                  console.log('user successfully deleted');
    //              })
    //          });
    //      });
    //      p.$all('users').$post({name: 'joe'}).then(function(user){
    //          console.log('I present you joe:');
    //          console.log(user);
    //      });
    //      p.$one('users', 123).$all('cars').$get().then(function(){});
    //      p.$one('users', 123).$one('cars', 456).$get();
    function presto(config, configurator) {
        var prestoConfig = {
            prestoFields: {
                'get': {name: '$get', fn: get},
                'put': {name: '$put', fn: put},
                'post': {name: '$post', fn: post},
                'delete': {name: '$delete', fn: remove},
                'serialize': {name: '$serialize', fn: serialize},
                'one': {name: '$one', fn: one},
                'all': {name: '$all', fn: all},
                'path': {name: '$path'}
            },
            ajax: {
                dataType: 'json',
                contentType: 'application/json; charset=utf-8'
            },
            baseUrl: '',
            idAttribute: 'id',
            urlMap: {}
        };

        prestoConfig = _.defaults(config || {}, prestoConfig);
        (configurator || _.identity)(prestoConfig);

        var pathName = prestoConfig.prestoFields.path.name;
        this[pathName] = prestoConfig.baseUrl;

        this[prestoConfig.prestoFields.one.name] = _.bind(one, this);
        this[prestoConfig.prestoFields.all.name] = _.bind(all, this);

        // ## one
        //
        // Instantiates a presto object to retrieve a single resource based on a url and id
        //
        // @param url the url of the resource collection / list
        // @param id the id of the specific resource
        //
        // **Example usage**:
        //
        //      var p = new presto();
        //      p.one('users', 12).get();
        //
        // This would trigger an api call to `http://domain.com/users/12`
        //
        // @return a presto object
        function one(url, id) {
            var ret = {};
            bindOne(ret, this);

            var path = this[pathName] ? this[pathName] + '/' : '';
            url = prestoConfig.urlMap[url] || url;
            ret[pathName] = makeUrl(path + url + '/' + id);

            return ret;
        }

        // ## all
        //
        // Instantiates a presto object to retrieve a list of resources based on a url
        //
        // @param url the url of the resource collection / list
        //
        // **Example usage**:
        //
        //      var p = new presto();
        //      p.all('users').get();
        //
        // This would trigger an api call to `http://domain.com/users`
        //
        // Calls to `one` and `all` can be piped to access child resources:
        //
        //      var p = new presto();
        //      p.one('users', 123).all('cars').get();
        //
        // Would trigger an API call to `http://domain.com/users/123/cars`
        function all(url) {
            var ret = {};
            bindOne(ret, this);

            var path = this[pathName] ? this[pathName] + '/' : '';
            url = prestoConfig.urlMap[url] || url;
            ret[pathName] = makeUrl(path + url);

            return ret;
        }

        // ## bindFunctions
        //
        // Not exposed as public API.
        //
        // Binds all prestoFields functions to a new presto object
        function bindFunctions(object, config) {
            _.each(_.keys(config.prestoFields), function(key){
                var field = config.prestoFields[key];
                if (field.fn) {
                    object[field.name] = _.bind(field.fn, object);
                }
            });
            return object;
        }

        // ## bindOne
        //
        // Not exposed as public API.
        //
        // Binds all presto fields and functions to a new presto object
        function bindOne(object, original) {
            bindFunctions(object, prestoConfig);

            var simpleFields = [];
            var fields = prestoConfig.prestoFields;
            _.each(_.keys(fields), function(key){
                if (!fields[key].fn) {
                    simpleFields.push(fields[key].name);
                }
            });
            _.defaults(object, _.pick(original, simpleFields));
        }

        // ## bindAll
        //
        // Not exposed as public API.
        //
        // Binds all presto fields and functions to an array as well as to all objects
        // in the array.
        function bindAll(list, original) {
            _.each(list, function(item){
                bindOne(item, original);
                item[pathName] = makeUrl(item[pathName] + '/' + item[prestoConfig.idAttribute]);
            });
        }

        function serialize() {
            if (!_.isArray(this)) {
                var fields = prestoConfig.prestoFields;
                var omits = [];
                _.each(_.keys(fields), function(key){
                    omits.push(fields[key].name);
                });

                return JSON.stringify(_.omit(this, omits));
            }
        }

        // ## makeUrl
        //
        // Not exposed as public API.
        //
        // Make a url based on a path and query object.
        //
        // @param path the base url path
        // @param query a hash object of all values to input in the query string.
        //
        // **Example usage**:
        //
        //      makeUrl('/api/users/123')
        //      // => '/api/users/123'
        //      makeUrl('/api/users/123', {name: 'bob', max: 10})
        //      // => '/api/users/123?name=bob&max=10'
        function makeUrl(path, query) {
            if (query) {
                path += '?' + $.param(query);
            }

            return path.replace('//', '/');
        }

        // ## allHttp
        //
        // Not exposed as public API.
        //
        // Used by all other HTTP methods (get, post, put, delete) to handle the
        // ajax request.
        //
        // @param ajaxConfig complete jQuery ajax config
        // @param object the object currently triggering this ajax call
        //
        // @return jQuery promise
        function allHttp(ajaxConfig, object) {
            var promise = $.ajax(ajaxConfig);

            promise.then(function(data) {
                if (_.isArray(data)) {
                    bindAll(data, object);
                }
                bindOne(data, object);
            });

            return promise;
        }

        // ## get
        //
        // Trigger a get request to the api.
        //
        // @param query a hash object to be converted to a query string.
        // @return jQuery promise
        //
        // **Example usage**:
        //
        //      var p = new presto();
        //      p.all('users').get({start: 30, max: 10}).then(function(data){
        //          // Do something with the retrieved data
        //      });
        //
        // Would issue a request to `http://domain.com/users?start=30&max=10`
        function get(query) {
            var ajaxConfig = {
                url: makeUrl(this[pathName], query),
                method: 'GET'
            };
            ajaxConfig = _.defaults(ajaxConfig, prestoConfig.ajax);

            return allHttp(ajaxConfig, this);
        }

        // ## post
        //
        // Posts new data to the api. As post is for the creation of new resources,
        // the data must be passed as a parameter. The data of the current presto
        // object will not be used.
        //
        // @param the data to be posted
        // @param query (see `get`)
        // @return jQuery promise
        function post(data, query) {
            var ajaxConfig = {
                url: makeUrl(this[pathName], query),
                method: 'POST',
                data: JSON.stringify(data),
                dataType: 'json',
                contentType: 'application/json; charset=utf-8'
            };
            ajaxConfig = _.defaults(ajaxConfig, prestoConfig.ajax);

            return allHttp(ajaxConfig, this);
        }

        // ## put
        //
        // Update the new value of current object to the server.
        //
        // @param query
        // @return jQuery promise
        function put(query) {
            var ajaxConfig = {
                url: makeUrl(this[pathName], query),
                method: 'PUT',
                data: this.$serialize(),
                dataType: 'json',
                contentType: 'application/json; charset=utf-8'
            };
            ajaxConfig = _.defaults(ajaxConfig, prestoConfig.ajax);

            return allHttp(ajaxConfig, this);
        }

        // ## remove
        //
        // By default this is mapped to `$delete`
        //
        // @return jQuery promise
        function remove(query) {
            var ajaxConfig = {
                url: makeUrl(this[pathName], query),
                method: 'DELETE',
                contentType: 'application/json; charset=utf-8',
                dataType: 'json'
            };
            ajaxConfig = _.defaults(ajaxConfig, prestoConfig.ajax);

            return allHttp(ajaxConfig, this);
        }
    }

    /************************************
        Exposing presto
    ************************************/


    // CommonJS module is defined
    var hasModule = (typeof module !== 'undefined' && module.exports);
    if (hasModule) {
        module.exports = presto;
    }
    if (typeof ender === 'undefined') {
        this.presto = presto;
    }
    if (typeof define === "function" && define.amd) {
        define("presto", [], function () {
            return presto;
        });
    }

}).call(this);