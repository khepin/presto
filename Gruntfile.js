/**
 * To use grunt, refer to http://gruntjs.com/
 */
module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: ['presto.js']
    },
    clean: {
      build: ['dist/']
    },
    uglify: {
      build: {
        src: ['presto.js'],
        dest: './dist/presto.min.js'
      }
    },
    jasmine: {
      specs: {
        src : 'presto.js',
        options: {
          specs: 'specs/**/*.js',
          helpers: ['bower_components/jquery/jquery.js', 'bower_components/lodash/dist/lodash.js']
        }
      }
    },
    docco: {
      docs: {
        src: ['./presto.js'],
        options: {
          output: 'docs'
        }
      }
    },
    copy: {
      dist: {
        src: 'presto.js',
        dest: 'dist/'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-docco2');

  // Default task.
  grunt.registerTask('default', 'jshint');
  grunt.registerTask('spec', 'jasmine');
  grunt.registerTask('build', ['jshint', 'clean', 'jasmine', 'docco', 'copy', 'uglify']);
};