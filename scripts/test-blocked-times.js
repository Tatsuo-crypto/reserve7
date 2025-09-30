/**
 * Test script for blocked times functionality
 * This script tests the API endpoints and database operations
 */

const { createClient } = require('@supabase/supabase-js')

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testBlockedTimesTable() {
  console.log('🔍 Testing blocked_times table...')
  
  try {
    // Test if table exists by trying to select from it
    const { data, error } = await supabase
      .from('blocked_times')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('❌ blocked_times table does not exist or has issues:', error.message)
      return false
    }
    
    console.log('✅ blocked_times table exists and is accessible')
    return true
  } catch (err) {
    console.error('❌ Error testing blocked_times table:', err.message)
    return false
  }
}

async function testCreateBlockedTime() {
  console.log('🔍 Testing blocked time creation...')
  
  try {
    const testData = {
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
      reason: 'テスト用メンテナンス',
      calendar_id: 'tandjgym@gmail.com',
      recurrence_type: 'none'
    }
    
    const { data, error } = await supabase
      .from('blocked_times')
      .insert(testData)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Failed to create blocked time:', error.message)
      return null
    }
    
    console.log('✅ Successfully created test blocked time:', data.id)
    return data
  } catch (err) {
    console.error('❌ Error creating blocked time:', err.message)
    return null
  }
}

async function testUpdateBlockedTime(id) {
  console.log('🔍 Testing blocked time update...')
  
  try {
    const { data, error } = await supabase
      .from('blocked_times')
      .update({ reason: 'テスト用メンテナンス（更新済み）' })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Failed to update blocked time:', error.message)
      return false
    }
    
    console.log('✅ Successfully updated blocked time')
    return true
  } catch (err) {
    console.error('❌ Error updating blocked time:', err.message)
    return false
  }
}

async function testDeleteBlockedTime(id) {
  console.log('🔍 Testing blocked time deletion...')
  
  try {
    const { error } = await supabase
      .from('blocked_times')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('❌ Failed to delete blocked time:', error.message)
      return false
    }
    
    console.log('✅ Successfully deleted test blocked time')
    return true
  } catch (err) {
    console.error('❌ Error deleting blocked time:', err.message)
    return false
  }
}

async function testOverlapDetection() {
  console.log('🔍 Testing overlap detection logic...')
  
  try {
    // Create a test blocked time
    const testStart = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // Day after tomorrow
    const testEnd = new Date(testStart.getTime() + 2 * 60 * 60 * 1000) // 2 hours later
    
    const { data: blockedTime, error: createError } = await supabase
      .from('blocked_times')
      .insert({
        start_time: testStart.toISOString(),
        end_time: testEnd.toISOString(),
        reason: 'オーバーラップテスト',
        calendar_id: 'tandjgym@gmail.com',
        recurrence_type: 'none'
      })
      .select()
      .single()
    
    if (createError) {
      console.error('❌ Failed to create test blocked time for overlap test:', createError.message)
      return false
    }
    
    // Test overlap detection query
    const overlapStart = new Date(testStart.getTime() + 30 * 60 * 1000) // 30 minutes into the blocked time
    const overlapEnd = new Date(overlapStart.getTime() + 60 * 60 * 1000) // 1 hour duration
    
    const { data: overlaps, error: queryError } = await supabase
      .from('blocked_times')
      .select('id, reason')
      .eq('calendar_id', 'tandjgym@gmail.com')
      .gt('end_time', overlapStart.toISOString())
      .lt('start_time', overlapEnd.toISOString())
    
    if (queryError) {
      console.error('❌ Failed to query for overlaps:', queryError.message)
      return false
    }
    
    if (overlaps && overlaps.length > 0) {
      console.log('✅ Overlap detection working correctly - found', overlaps.length, 'overlapping blocked times')
    } else {
      console.log('❌ Overlap detection failed - should have found overlapping blocked time')
    }
    
    // Clean up test data
    await supabase.from('blocked_times').delete().eq('id', blockedTime.id)
    
    return overlaps && overlaps.length > 0
  } catch (err) {
    console.error('❌ Error testing overlap detection:', err.message)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Starting blocked times functionality tests...\n')
  
  const results = {
    tableExists: false,
    createTest: false,
    updateTest: false,
    deleteTest: false,
    overlapTest: false
  }
  
  // Test 1: Table existence
  results.tableExists = await testBlockedTimesTable()
  console.log('')
  
  if (!results.tableExists) {
    console.log('❌ Cannot proceed with tests - blocked_times table not found')
    console.log('💡 Please run the database migration script first:')
    console.log('   psql -d your_database -f database/create_blocked_times_table.sql')
    return results
  }
  
  // Test 2: Create blocked time
  const createdBlockedTime = await testCreateBlockedTime()
  results.createTest = !!createdBlockedTime
  console.log('')
  
  if (createdBlockedTime) {
    // Test 3: Update blocked time
    results.updateTest = await testUpdateBlockedTime(createdBlockedTime.id)
    console.log('')
    
    // Test 4: Delete blocked time
    results.deleteTest = await testDeleteBlockedTime(createdBlockedTime.id)
    console.log('')
  }
  
  // Test 5: Overlap detection
  results.overlapTest = await testOverlapDetection()
  console.log('')
  
  // Summary
  console.log('📊 Test Results Summary:')
  console.log('========================')
  console.log(`Table exists: ${results.tableExists ? '✅' : '❌'}`)
  console.log(`Create operation: ${results.createTest ? '✅' : '❌'}`)
  console.log(`Update operation: ${results.updateTest ? '✅' : '❌'}`)
  console.log(`Delete operation: ${results.deleteTest ? '✅' : '❌'}`)
  console.log(`Overlap detection: ${results.overlapTest ? '✅' : '❌'}`)
  
  const allPassed = Object.values(results).every(result => result === true)
  console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)
  
  return results
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Test execution failed:', error)
      process.exit(1)
    })
}

module.exports = { runAllTests }
