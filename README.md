# code-gov-stats

A simple app to extract stats about repositories using the Github API and [Cloc](https://github.com/AlDanial/cloc)

## Dependencies

1. Github: The repo information is completly gathered from Github. There are a number of libraries you can use to accomplish this. We are using [@octokit/rest](https://www.npmjs.com/package/@octokit/rest).
2. Cloc: Part of the analysis we are conducting is the cost of software. We are using Cloc to get a project's lines of code. This total is then used with [COCOMO II](http://csse.usc.edu/tools/cocomoii.php) to calculate costs and savings. You can find information for [CLOC here](https://github.com/AlDanial/cloc).


## Calculating Cost and Savings

Code.gov estimates the evaluation of the federal open source program by using the Constructive Cost Model II -- CoCoMoII.

- COCOMOII uses a regression formula of historical projects to estimates, size, effort, duration and cost of the software.
- Code.gove uses COCOMOII by counting lines of code in a repository, and assigns an hourly rate of $48 -- the median hourly salary for a software developer and programmer according to the Bureau of Labor and Statistics.
- Since CoCoMoII calculates based on person-months (19 days), we adjust $48/hr to a monthly cost -- $48(19 days x 8 hours) = $7,296. We keep all factors, such as Risk and Analyst Capability as nominal.
- COCOMOII generates an estimated cost to create the software and the amount of time in person-months to develop the program. 
- The cost becomes our estimated cost to the government to create, or investment. 
- Code.gov multiplies cost by the number of agencies using the program, omitting the creating agency. 
- This becomes our estimated cost-savings, or estimated net profit
- Using investment and net profit we are able to calculate the government’s estimated return on investment over the project lifespan and annualized by taking an estimated yearly average.
- To calculate labor hours, we take the person-months and multiply by 152 -- (19 days x 8 hours).
