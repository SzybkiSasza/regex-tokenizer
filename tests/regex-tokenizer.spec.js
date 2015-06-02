define(function(require) {
  'use strict';

  var tokenizer = require('commons/regex-tokenizer');

  describe('Regex Tokenizer', function() {

    it('Should return false if token validator is not passed to validator function', function() {
      var regex = /^tes.$/;
      var tokens = tokenizer.analyzeRegex(regex);
      expect(tokenizer.validateRegexToken(tokens, false)).toEqual(false);
    });

    it('Should analyze regex and create special token object for storing tokenized regex', function() {
      var regex = /^tes.i[a-z]g$/;
      var tokens = tokenizer.analyzeRegex(regex);

      expect(tokens.matches[0].matches).toBeDefined();
      expect(tokens.matches[0].matches.length).toEqual(5);
    });


    it('Should validate provided phrases against simple Regex', function() {
      var regex = /^te?s[a-zA-Z]$/;
      var tokens = tokenizer.analyzeRegex(regex);
      expect(tokenizer.validateRegexToken(tokens, false, 'reeesm')).toEqual(false);

      expect(tokenizer.validateRegexToken(tokens, false, 'te')).toEqual(true);
      expect(tokenizer.validateRegexToken(tokens, false, 'ts')).toEqual(true);
      expect(tokenizer.validateRegexToken(tokens, false, 'test')).toEqual(true);
    });

    it('Should validate provided phrases against Regex with groups', function() {
      var regex = /^te(s[a-zA-Z]*){1,2}\d{1,2}$/;
      var tokens = tokenizer.analyzeRegex(regex);

      expect(tokenizer.validateRegexToken(tokens, false, 'tertst')).toEqual(false);
      expect(tokenizer.validateRegexToken(tokens, false, 'te12')).toEqual(false);

      expect(tokenizer.validateRegexToken(tokens, false, 'testst')).toEqual(true);
      expect(tokenizer.validateRegexToken(tokens, false, 'testst1')).toEqual(true);
      expect(tokenizer.validateRegexToken(tokens, false, 'tesr43')).toEqual(true);
    });

    it('Should validate provided phrases against Regex with nested groups', function() {
      var regex = /^te(st(a.){1,2}(b)?){2,}$/;
      var tokens = tokenizer.analyzeRegex(regex);

      expect(tokenizer.validateRegexToken(tokens, false, 'rest')).toEqual(false);
      expect(tokenizer.validateRegexToken(tokens, false, 'testabf')).toEqual(false);

      expect(tokenizer.validateRegexToken(tokens, false, 'testacagb')).toEqual(true);
      expect(tokenizer.validateRegexToken(tokens, false, 't')).toEqual(true);
      expect(tokenizer.validateRegexToken(tokens, false, 'test')).toEqual(true);
      expect(tokenizer.validateRegexToken(tokens, false, 'testa')).toEqual(true);
      expect(tokenizer.validateRegexToken(tokens, false, 'testacavstanb')).toEqual(true);
      expect(tokenizer.validateRegexToken(tokens, false, 'testacavbstan')).toEqual(true);
    });
  });
});
