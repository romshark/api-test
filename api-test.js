const libreq = require('request')
const libasync = require('async')

function mergeObjects(base, target) {
	const newObj = {}
	for(key in base) {
		newObj[key] = base[key]
	}
	for(key in target) {
		newObj[key] = target[key]
	}
	return newObj
}

module.exports = function(config) {
	if(!config.schema) {
		config.schema = 'http'
	}
	if(!config.host) {
		config.host = 'localhost'
	}
	if(!config.port) {
		config.port = 80
	}
	if(!config.tests) {
		config.tests = []
	}
	const self = this
	var _headers = {}

	self.headers = {
		list: function() {
			return _headers
		},
		set: function(headerName, value) {
			_headers[headerName.toLowerCase()] = value
		},
		drop: function(headerName) {
			delete _headers[headerName.toLowerCase()]
		}
	}

	function request(data) {
		return new Promise(function(resolve, reject) {
			var headers = mergeObjects(_headers, data.headers)
			var url = config.schema
				+ '://'
				+ config.host
				+ ':'
				+ config.port
				+ '/'
				+ data.resource
			if(data.parameters) {
				url += '?'
				var pairs = []
				for(key in data.parameters) {
					pairs.push(key + '=' + data.parameters[key])
				}
				url += pairs.join('&')
			}
			if(data.data) {
				headers['content-type'] = 'multipart/form-data'
			}
			const options = {
				forever: true,
				method: data.method,
				url: url,
				headers: headers,
				formData: data.data,
			}
			libreq(options, function(error, response) {
				if(error) {
					reject(error)
					return
				}
				switch(response.headers['content-type']) {
				case 'application/json':
					response.body = JSON.parse(response.body)
					break
				}
				resolve(response)
			})
		})
	}

	self.begin = new Date()
	self.end
	self.failedTests = []
	self.succededTests = []
	self.continue = true
	self.currentTestIndex = 0
	self.currentTest

	function evaluation() {
		return self.continue
			&& (self.currentTestIndex < config.tests.length)
	}

	function execution(evaluate) {
		self.currentTest = config.tests[self.currentTestIndex]
		console.log(
			self.currentTestIndex + 1 + '.',
			self.currentTest.method,
			'/' + self.currentTest.resource
		)
		request({
			method: self.currentTest.method,
			resource: self.currentTest.resource,
			headers: self.currentTest.headers,
			parameters: self.currentTest.parameters,
			data: self.currentTest.data
		})
		.then(function(result) {
			self.currentTest.evaluation({
				status: result.statusCode,
				headers: result.headers,
				body: result.body
			})
			self.succededTests.push(self.currentTest)
			++self.currentTestIndex
			evaluate()
		})
		.catch(function(error) {
			++self.currentTestIndex
			self.failedTests.push(self.currentTest)
			console.log('\nFAILURE:', error)
			self.continue = false
			evaluate()
		})
	}

	function completion() {
		self.end = new Date()
		console.log('\n' + self.currentTestIndex + ' tests completed')
		console.log('  succeded:  ' + self.succededTests.length)
		console.log('  failed:    ' + self.failedTests.length)
		console.log('  duration:  ' + (self.end - self.begin) + ' ms')
	}

	//execute tests
	libasync.whilst(
		evaluation,
		execution,
		completion
	)
}