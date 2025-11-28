#ifndef EVAL_H_
#define EVAL_H_
// #include "Graph.h"
#include <iostream>
#include <vector>
#include <unordered_map>
#include <map>
#include <unordered_set>
#include <set>
#include <queue>
#include <algorithm>
#include <string>
#include <fstream>
#include <sstream>
#include <ctime>
#include <cstdlib>
#include <cmath>
#include <iomanip>
// #define NDEBUG
#include <cassert>
using namespace std;

vector<int> load_source_id_list(string data_dir, int source_node_count);
// Graph load_graph(string data_dir);
bool get_is_directed(string data_dir);
// void insert_edges(vector<pair<Node*, Node*>>& edges_to_insert, Graph& graph);
double calc_ndcg(map<int, double>& exact_ppr, map<int, double>& approx_ppr, int k);
double calc_dcg(const vector<int>& approx_ranking, const map<int, double>& exact_ppr);
double calc_perfect_dcg(const map<int, double>& exact_ppr, int k);
double calc_spearmanr(const map<int, double>& ppr1, const map<int, double>& ppr2, int k);
double calc_ap_correlation(const map<int, double>& ppr1, const map<int, double>& ppr2);
double calc_symmetric_ap_correlation(const map<int, double>& ppr1, const map<int, double>& ppr2);
vector<pair<int, double>> get_ordered_map(const map<int, double>& ppr);
vector<pair<int, double>> get_ordered_vector(const vector<double>& v);
map<int, double> get_normalized_map(const map<int, double>& ppr);
void show_timestamp();
string get_timestamp();
// void remove_edge(Node* src_node, Node* dst_node, bool is_directed);
// vector<pair<int, int>> create_edge_list(Graph& graph);
double get_time_in_sec(clock_t start, clock_t end);
double get_time_in_sec(clock_t time);
void set_exact_ppr(string data_dir, map<int, map<int, double>>& exact_ppr, int source_node_count);
double dotProduct(const map<int, double>& v1, const map<int, double>& v2);
double l2_norm(const map<int, double>& v);
double l2_norm(vector<double>& v);
map<int, double> scalarMultiply(const map<int, double>& v, double scalar);
map<int, double> vectorSubtract(const map<int, double>& v1, const map<int, double>& v2);
map<int, double> normalize(const map<int, double>& v);
map<int, double> extractPartialOrthogonalComponent(const map<int, double>& A, const map<int, double>& B);
double calc_cosine_similarity(const map<int, double>& v1, const map<int, double>& v2);
void show_map(const map<int, double> v);

#endif