import { Configuration, OpenAIApi } from "openai";
const sdk = require('api')('@control/v2022-07-18#7xvueytb2xflflhue6n');
sdk.auth(process.env.LATITUDE_API_KEY);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function (req, res) {
  if (!configuration.apiKey) {
    res.status(500).json({
      error: {
        message: "OpenAI API key not configured, please follow instructions in README.md",
      }
    });
    return;
  }

  const request = req.body.animal || '';
  if (request.trim().length === 0) {
    res.status(400).json({
      error: {
        message: "Please enter a valid request",
      }
    });
    return;
  }

  try {
    const data = await sdk.getPlans();
    // console.log(typeof data.data.data)
    const content = generatePrompt(request, data.data.data);
    console.log(`Request: ${request}`);
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{
        role: 'user',
        content: content,
        name: 'anon',
      }],
      temperature: 0,
    });
    const message = completion.data.choices[0].message;
    console.log("Message: ", message);
    try {
      const response = JSON.parse(message.content.replace("\n", ""));
      if (response?.plan) {
        const plan = response.plan.replaceAll(".", "-");
        try {
          const createServerPayload = {
            data: {
              type: 'servers',
              attributes: {
                project: 'baxus-dev',
                plan: plan,
                site: response.region,
                operating_system: 'ubuntu_20_04_x64_lts',
                hostname: response.hostname
              }
            }
          };
          console.log(`Create server payload: ${JSON.stringify(createServerPayload)}`);
          const createServerResponse = await sdk.createServer(createServerPayload);
          console.log(`Created the following server: ${createServerResponse.data.data.attributes.hostname}`);
          return res.status(200).json(message);
        } catch (error) {
          console.error(`Error with Latitude API request`, error.data.errors);
          return res.status(500).json({
            error: {
              message: 'Creating Latitude server failed. Contact support.',
            }
          });
        }
      }
    } catch (error) {
      return res.status(200).json(message);
    }
  } catch (error) {
    // Consider adjusting the error handling logic for your use case
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).json({
        error: {
          message: 'An error occurred during your request.',
        }
      });
    }
  }
}

function generatePrompt(request, data) {
  return `Considering following available plans for virtual machines:

${data.slice(0, 10).map(generatePlans).join('\n')}

Reply to  following input from user help user to pick a plan, region and os.: 
user input: ${request}

reject any other type of request.

when you found a plan, region and os, reply in valid json structure including a generated superhero hostname:`;
}

function generatePlans(data) {
  const planData = data.attributes || {};

  const name = planData.name || 'Unnamed plan';
  const specs = planData.specs || {};
  const available_in = planData.available_in || [];
  const cpus = specs.cpus || [];
  const memory = specs.memory?.total || 'N/A';
  const drives = specs.drives || [];
  const nics = specs.nics || [];
  const gpus = specs.gpu || [];

  const cpuDetails = cpus
    .map(cpu => `${cpu.count}x ${cpu.type} ${cpu.cores} cores ${cpu.clock}GHz`)
    .join(', ');
  const driveDetails = drives
    .map(drive => `${drive.count}x ${drive.size} ${drive.type}`)
    .join(', ');
  const nicDetails = nics.map(nic => `${nic.count}x ${nic.type}`).join(', ');
  const gpuDetails = gpus.map(gpu => `${gpu.count}x ${gpu.type}`).join(', ');

  const availablility = available_in.map(availablity => availablity.sites.map(site => site.in_stock ? site.slug : null).filter(availablity => availablity)).filter(availablity => availablity.length > 0).join(',');

  const description = `Name: ${name}: CPUs - (${cpuDetails}), Memory - ${memory} GB, Drives - (${driveDetails}), Available Regions - (${availablility})`;
  // const description = `Name: ${name}: CPUs - (${cpuDetails}), Memory - ${memory} GB, Drives - (${driveDetails}), NICs - (${nicDetails}), GPUs - (${gpuDetails})`;

  return `\n${description}`;
}