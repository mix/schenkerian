test:
	NODE_ENV=test ./node_modules/.bin/mocha --exit --ui bdd --reporter spec --timeout 30000 --recursive ./tests/setup.js ./tests/*

lint:
	./node_modules/.bin/jshint --reporter=./config/reporter.js ./
