import { predictionEngine } from './server/services/predictions/predictionEngine';

async function test() {
  console.log('Testing Prediction Engine...\n');

  try {
    console.log('Step 1: Generating predictions...');
    const predictions = await predictionEngine.generatePredictions();
    console.log(`✓ Generated ${predictions.length} predictions\n`);

    if (predictions.length > 0) {
      console.log('Sample predictions:');
      predictions.slice(0, 3).forEach((pred, i) => {
        console.log(`\n${i + 1}. ${pred.title}`);
        console.log(`   Confidence: ${pred.confidence_score}`);
        console.log(`   Window: ${pred.predicted_window}`);
        console.log(`   Status: ${pred.status}`);
        console.log(`   Text: ${pred.prediction_text.substring(0, 150)}...`);
      });
    }

    console.log('\n\nStep 2: Fetching top predictions...');
    const topPredictions = await predictionEngine.getTopPredictions(10);
    console.log(`✓ Retrieved ${topPredictions.length} predictions\n`);

    if (topPredictions.length > 0) {
      console.log('Top predictions:');
      topPredictions.forEach((pred, i) => {
        console.log(`${i + 1}. ${pred.title} (Score: ${pred.confidence_score})`);
      });
    }

    console.log('\n✓ Test completed successfully!');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

test();
