describe('presto', function(){

    it('can be instantiated', function(){
        var p = new presto()
        expect(p).not.toBe(null)
    })

    describe('configuration', function(){
        it('can change the baseUrl and idAttribute', function(){
            var c
            new presto({baseUrl: 'a_url', idAttribute: '__id__'}, function(config){
                c = config
            })
            expect(c.baseUrl).toBe('a_url')
            expect(c.idAttribute).toBe('__id__')
        })

        it('can configure method names', function(){
            _.each(['get','put','post','delete','serialize','one','all','path'], function(method){
                var p = new presto({}, function(config){
                    config.prestoFields[method].name = 'newMethodName'
                })
                if (method != 'one') {
                    expect(p.$one('users', 1)[method]).toBeUndefined()
                    expect(p.$one('users', 1).newMethodName).toBeDefined()
                } else {
                    expect(p.$all('users', 1)[method]).toBeUndefined()
                    expect(p.$all('users', 1).newMethodName).toBeDefined()
                }
            })
        })
    })

    describe('paths', function() {
        it('builds simple single paths', function(){
            var p = new presto()

            expect(p.$one('users', 1).$path).toBe('users/1')
            expect(p.$one('/users', 1).$path).toBe('/users/1')
        })

        it('builds simple list paths', function(){
            var p = new presto()

            expect(p.$all('users').$path).toBe('users')
            expect(p.$all('/users').$path).toBe('/users')
        })

        it('builds paths that include the baseUrl', function(){
            var p = new presto({baseUrl: '/api/'})

            expect(p.$one('users', 1).$path).toBe('/api/users/1')
            expect(p.$all('users').$path).toBe('/api/users')
        })

        it('builds complex children paths', function(){
            var p = new presto()

            expect(p.$one('users', 1).$all('cars').$path).toBe('users/1/cars')
            expect(p.$one('users', 5).$one('cars', 6).$all('drivers').$path).toBe('users/5/cars/6/drivers')

            p = new presto({baseUrl: '/api/'})
            expect(p.$one('users', 5).$one('cars', 6).$all('drivers').$path).toBe('/api/users/5/cars/6/drivers')
        })

        it('can use a urlMap', function(){
            var p = new presto({
                urlMap: {
                    users: '/api/admin/users'
                }
            })
            expect(p.$one('users', 1).$path).toBe('/api/admin/users/1')
            expect(p.$all('users').$path).toBe('/api/admin/users')

            expect(p.$one('cars', 1).$path).toBe('cars/1')
        })
    })

    describe('serialization', function(){
        it('serializes objects without presto properties', function(){
            var p = new presto()
            var o = p.$one('users', 1)
            _.defaults(o, {name: 'bob', dog: 'rufus'})

            expect(o.$path).toBe('users/1')

            var ser = o.$serialize()
            expect(_.isString(ser)).toBe(true)
            ser = JSON.parse(ser)

            expect(ser.$path).toBeUndefined()
            expect(ser.$one).toBeUndefined()
            expect(ser.name).toBe('bob')
            expect(ser.dog).toBe('rufus')
        })
    })

    describe('REST interaction', function(){

        var ajaxConfig
        var deferred
        $.ajax = function(config) {
            ajaxConfig = config
            deferred = new $.Deferred()
            var p = deferred.promise()
            p.name = 'bob'
            return p
        }

        describe('$get', function(){
            it('can get a single resource from a server', function(){
                var p = new presto()
                p.$one('users', 123).$get()
                expect(ajaxConfig.url).toBe('users/123')
            })

            it('can use query strings', function(){
                var p = new presto()
                p.$one('users', 123).$get({active: true, updated_since: '2012-01-01'})
                expect(ajaxConfig.url).toBe('users/123?active=true&updated_since=2012-01-01')
            })

            it('adds presto functions to retrieved objects', function(){
                var p = new presto()
                var retrieved
                p.$one('users', 123).$get().then(function(user){
                    retrieved = user
                })

                deferred.resolve({name: 'bob'})

                expect(retrieved.$one).toBeDefined()
                expect(typeof retrieved.$one).toBe('function')
            })

            it('can get a list of resources from a server', function(){
                var p = new presto()
                p.$all('users').$get()
                expect(ajaxConfig.url).toBe('users')
            })

            it('adds presto functions to the list and all listed objects', function() {
                var p = new presto()
                var retrieved

                p.$all('users').$get().then(function(users){
                    retrieved = users
                })

                deferred.resolve([{name: 'bob'}, {name: 'mike'}])

                expect(typeof retrieved.$one).toBe('function')
                expect(typeof retrieved[0].$one).toBe('function')
                expect(typeof retrieved[1].$one).toBe('function')
            })

            it('creates the path for each object in the list', function(){
                var p = new presto()
                var retrieved

                p.$all('users').$get().then(function(users){
                    retrieved = users
                })

                deferred.resolve([{name: 'bob', id: 1}, {name: 'mike', id: 2}])

                expect(retrieved[0].$path).toBe('users/1')
                expect(retrieved[1].$path).toBe('users/2')
            })

            it('creates the path for each obect based on the idAttribute configuration', function(){
                var p = new presto({idAttribute: '__id__'})
                var retrieved

                p.$all('users').$get().then(function(users){
                    retrieved = users
                })

                deferred.resolve([{name: 'bob', id: 1, __id__: 10}, {name: 'mike', id: 2, __id__: 20}])

                expect(retrieved[0].$path).toBe('users/10')
                expect(retrieved[1].$path).toBe('users/20')
            })
        })

        describe('$put', function(){
            it('can update a resource', function(){
                var p = new presto()
                var retrieved
                p.$one('users', 123).$get().then(function(user){
                    retrieved = user
                })

                deferred.resolve({name: 'bob'})
                retrieved.name = 'mike'

                retrieved.$put()

                expect(ajaxConfig.url).toBe('users/123')
                expect(ajaxConfig.method).toBe('PUT')
                expect(JSON.parse(ajaxConfig.data).name).toBe('mike')
            })
        })

        describe('$post', function(){
            it('can create a new resource', function(){
                var p = new presto()
                p.$all('users').$post({name: 'bob'})

                expect(ajaxConfig.url).toBe('users')
                expect(ajaxConfig.method).toBe('POST')

                expect(ajaxConfig.data).toBe(JSON.stringify({name: 'bob'}))
            })
        })

        describe('$delete', function(){
            it('can delete a resource', function(){
                var p = new presto()
                var retrieved
                p.$one('users', 123).$get().then(function(user){
                    retrieved = user
                })

                deferred.resolve({name: 'bob'})

                retrieved.$delete()

                expect(ajaxConfig.url).toBe('users/123')
                expect(ajaxConfig.method).toBe('DELETE')
            })
        })
    })
})