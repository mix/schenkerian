test:
	NODE_ENV=test ./node_modules/.bin/mocha --ui bdd --reporter spec --timeout 2000 --recursive ./tests/setup.js ./tests/*
