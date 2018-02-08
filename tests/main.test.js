const chai = require('chai'),
  should = chai.should()

const { parseGithubUrl, isGithubUrl, getData, writeOutData } = require('../libs/utils')

describe('parseGithubUrl', function () {
  it('should return a github user and repo name', function () {
    const expected = {
      githubUser: 'GSA',
      repoName: 'code-gov-web'
    }
    const result = parseGithubUrl('https://github.com/GSA/code-gov-web')

    result.should.be.deep.equal(expected)
  })
})

describe('writeOurData', function () {
  it('should write out a JSON file from data and filename supplied', function () {
    const testData = {
      name: 'code-gov-api',
      repo: 'https://github.com/GSA/code-gov-api',
      awesomeness_level: 'over 9000!!!!!'
    }

    writeOutData(testData, 'test-data.json')
  })
})
