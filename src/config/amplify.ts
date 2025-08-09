import { Amplify } from 'aws-amplify';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_y4GGRCtdR',
      userPoolClientId: '3thf1uf9n8bc7u0sogqv0bjrts',
      identityPoolId: 'ap-south-1:ce4fa149-520e-44b6-a006-128b8ef30c1b', // required for S3 uploads
      region: 'ap-south-1'
    }
  },
  Storage: {
    S3: {
      bucket: 'adler-personal-storage',
      region: 'ap-south-1'
    }
  },
  API: {
    REST: {
      CV_v1: {
        endpoint: 'https://necll2p9x2.execute-api.ap-south-1.amazonaws.com/Production',
        region: 'ap-south-1'
      }
    }
  }
};

Amplify.configure(amplifyConfig);

export default amplifyConfig;
